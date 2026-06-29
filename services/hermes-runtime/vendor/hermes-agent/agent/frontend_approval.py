# frontend_approval.py
# Camada OPCIONAL de aprovacao via frontend web.
#
# Adicionado em 2026-06-27 pra Opcao C (WebSocket approval system).
# NAO substitui o prompt TTY original - apenas oferece caminho alternativo
# quando o cliente eh frontend web (Next.js chat-web).
#
# Design decisions:
# 1. Zero impacto em clientes TUI/CLI existentes - o codigo original do
#    _prompt_and_record em shell_hooks.py NAO foi alterado em sua logica
#    sync; este modulo apenas expoe uma funcao opcional.
# 2. Fallback gracioso: se o frontend nao responder, o agent usa o
#    approvals.mode do config (ask/yolo/deny) como fallback. Default = deny.
# 3. Non-blocking opt-in: shell_hooks.py importa este modulo LAZY (so
#    quando precisa), evitando overhead em clientes que nao usam.
# 4. Race-safe: usa asyncio.Future com cleanup garantido via try/finally.

from __future__ import annotations

import asyncio
import json
import logging
import time
import uuid
from dataclasses import dataclass, field
from typing import Any, Dict, Optional, Set

logger = logging.getLogger(__name__)


# ----------------------------------------------------------------------------
# Estado global do modulo (single-process; o hermes-api server eh single-thread
# asyncio, entao nao precisamos de lock pra dicts internos).
# ----------------------------------------------------------------------------


@dataclass
class ApprovalRequest:
    """Representa um pedido de aprovacao pendente."""
    request_id: str
    event: str
    command: str
    description: str
    run_id: Optional[str] = None
    chat_session_id: Optional[str] = None
    created_at: float = field(default_factory=time.time)
    timeout_seconds: int = 30
    future: Optional[asyncio.Future] = None  # set quando usuario responde

    def to_dict(self) -> Dict[str, Any]:
        """Serializa pra mandar pro frontend (via WebSocket)."""
        return {
            "type": "approval_request",
            "request_id": self.request_id,
            "event": self.event,
            "command": self.command,
            "description": self.description,
            "run_id": self.run_id,
            "created_at": self.created_at,
            "expires_in": max(0, int(self.timeout_seconds - (time.time() - self.created_at))),
        }


# Map: request_id -> ApprovalRequest
_pending_requests: Dict[str, ApprovalRequest] = {}
# Map: chat_session_id -> Set[request_id] (pra cleanup quando sessao fecha)
_session_requests: Dict[str, Set[str]] = {}
# WebSocket clients conectados (set de queues pra broadcast)
_ws_clients: Set[asyncio.Queue] = set()


def register_ws_client(queue: asyncio.Queue) -> None:
    """Adiciona uma fila de WebSocket na lista de broadcast."""
    _ws_clients.add(queue)
    logger.debug("frontend_approval: ws client registered (total=%d)", len(_ws_clients))


def unregister_ws_client(queue: asyncio.Queue) -> None:
    """Remove fila de WebSocket (chamado quando cliente desconecta)."""
    _ws_clients.discard(queue)
    logger.debug("frontend_approval: ws client unregistered (total=%d)", len(_ws_clients))


async def _broadcast(message: Dict[str, Any]) -> None:
    """Envia mensagem pra todos os WebSocket clients conectados.

    Falhas individuais nao derrubam o broadcast (cliente pode estar
    desconectando, etc).
    """
    if not _ws_clients:
        logger.debug("frontend_approval: broadcast skipped (no ws clients)")
        return
    payload = json.dumps(message)
    dead_clients = set()
    for queue in list(_ws_clients):
        try:
            queue.put_nowait(payload)
        except asyncio.QueueFull:
            # Queue cheia = cliente lento. Marca pra remover depois.
            logger.warning("frontend_approval: ws queue full, dropping client")
            dead_clients.add(queue)
        except Exception as e:  # noqa: BLE001
            logger.warning("frontend_approval: broadcast failed: %s", e)
            dead_clients.add(queue)
    for dead in dead_clients:
        _ws_clients.discard(dead)


def is_frontend_client_active() -> bool:
    """Retorna True se ha pelo menos 1 cliente WebSocket conectado.

    Usado por shell_hooks.py pra decidir: prompt TTY OU HTTP/WS.
    Se nao ha cliente web conectado, o fallback TTY/negacao eh usado
    (preservando o comportamento original).
    """
    return bool(_ws_clients)


async def request_frontend_approval(
    event: str,
    command: str,
    *,
    description: str = "",
    run_id: Optional[str] = None,
    chat_session_id: Optional[str] = None,
    timeout_seconds: int = 30,
) -> bool:
    """Pede aprovacao via frontend web. BLOQUEIA ate resposta ou timeout.

    Args:
        event: tipo de evento (ex: "PreToolUse", "shell_hook")
        command: comando que precisa aprovacao
        description: explicacao human-readable
        run_id: ID da run do agent (pra correlacionar com chat)
        chat_session_id: ID da sessao de chat (pra mapear request -> usuario)
        timeout_seconds: tempo maximo de espera (default 30s)

    Returns:
        True se usuario aprovou, False se negou ou timeout.

    Comportamento:
        - Se nenhum cliente WebSocket conectado: retorna False (deny)
          pra preservar o comportamento TUI original (que tambem
          retornaria False sem stdin TTY).
        - Se cliente conectado mas nao responde em timeout: retorna False
          (deny). Modo seguro - nunca aprova sem confirmacao explicita.
    """
    request_id = str(uuid.uuid4())
    loop = asyncio.get_event_loop()
    future: asyncio.Future = loop.create_future()

    request = ApprovalRequest(
        request_id=request_id,
        event=event,
        command=command,
        description=description or f"Agent wants to run: {command[:200]}",
        run_id=run_id,
        chat_session_id=chat_session_id,
        timeout_seconds=timeout_seconds,
        future=future,
    )
    _pending_requests[request_id] = request
    if chat_session_id:
        _session_requests.setdefault(chat_session_id, set()).add(request_id)

    logger.info(
        "frontend_approval: request created id=%s event=%s cmd=%r",
        request_id, event, command[:80],
    )

    # Broadcast pro frontend
    await _broadcast(request.to_dict())

    # Espera resposta (com timeout)
    try:
        decision = await asyncio.wait_for(future, timeout=timeout_seconds)
        approved = decision == "approve"
        logger.info(
            "frontend_approval: request %s decided=%s approved=%s",
            request_id, decision, approved,
        )
        return approved
    except asyncio.TimeoutError:
        logger.warning(
            "frontend_approval: request %s timed out after %ds - denying",
            request_id, timeout_seconds,
        )
        return False
    finally:
        # Cleanup garantido mesmo em exception
        _cleanup_request(request_id)


def _cleanup_request(request_id: str) -> None:
    """Remove request do estado global. Idempotente."""
    request = _pending_requests.pop(request_id, None)
    if request and request.chat_session_id:
        session_set = _session_requests.get(request.chat_session_id)
        if session_set:
            session_set.discard(request_id)
            if not session_set:
                _session_requests.pop(request.chat_session_id, None)
    # Cancela future se ainda nao setada (evita warnings do asyncio)
    if request and request.future and not request.future.done():
        request.future.cancel()


def respond_to_approval(
    request_id: str,
    decision: str,
    trust_scope: str = "session",
) -> bool:
    """Chamado pelo endpoint HTTP /api/approvals/respond quando o
    frontend clica approve/deny.

    Args:
        request_id: ID do pedido (veio do broadcast)
        decision: "approve" ou "deny"
        trust_scope: "session" (so agora) ou "always" (registra allowlist)

    Returns:
        True se o request existia e foi resolvido, False se ja expirou.
    """
    request = _pending_requests.get(request_id)
    if not request:
        logger.warning("frontend_approval: respond for unknown/expired id=%s", request_id)
        return False

    if decision not in ("approve", "deny"):
        logger.error("frontend_approval: invalid decision=%s", decision)
        return False

    # Set o future pra desbloquear o request_frontend_approval aguardando
    if request.future and not request.future.done():
        request.future.set_result(decision)

    # Se trust_scope="always" e foi approve, registra na allowlist
    # (igual o _record_approval do shell_hooks original)
    if trust_scope == "always" and decision == "approve":
        try:
            from agent.shell_hooks import _record_approval
            _record_approval(request.event, request.command)
            logger.info(
                "frontend_approval: recorded always-allow for %s",
                request.command[:80],
            )
        except Exception as e:  # noqa: BLE001
            logger.warning("frontend_approval: failed to record allowlist: %s", e)

    return True


def cleanup_session(session_id: str) -> None:
    """Limpa todos os requests pendentes de uma sessao que foi fechada."""
    request_ids = _session_requests.pop(session_id, set())
    for rid in list(request_ids):
        _cleanup_request(rid)
    if request_ids:
        logger.info(
            "frontend_approval: cleaned up %d pending requests for session=%s",
            len(request_ids), session_id,
        )


def get_pending_count() -> int:
    """Telemetria: quantos requests estao pendentes agora."""
    return len(_pending_requests)
