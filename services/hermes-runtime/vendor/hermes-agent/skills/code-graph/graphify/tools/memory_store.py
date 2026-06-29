"""memory_store.py - Backend de memoria HIBRIDO (v3.8+ white-label).

Arquitetura dual-storage:

  GLOBAL (compartilhado entre users do tenant):
    - Arquivo: <data_dir>/memory/global.md
    - Conteudo: knowledge MCP RAG, estrategias de marketing, brand-book,
      guidelines da empresa. Lido e escrito por qualquer user do tenant.
    - Eh o "team brain" - tudo que a equipe compartilha.

  USER (privado por user_id):
    - Arquivo: <data_dir>/users/<user_id>/memory.md
    - Conteudo: gostos pessoais, nome do user, estilo de comunicacao,
      preferencias, historico de prompts.
    - Apenas o proprio user_id le/escreve.

Hierarquia no filesystem:
  /opt/data/memory/
    global.md                          (team knowledge)
    users/
      550e8400-e29b-41d4.../           (alice's dir)
        memory.md                      (preferences)
        preferences.md                 (UI prefs)
        style.md                       (estilo de comunica)

USO:
    from memory_store import MemoryStore
    
    store = MemoryStore(
        tenant_id="acme",
        user_id="alice",
        data_dir="/opt/data/memory",
    )
    
    # Global (team knowledge)
    store.write_global("# Strategy 2026\\nFocus on Q2...")
    store.read_global()
    
    # User (private)
    store.write_user("# Alice's prefs\\n- Lenguaje: formal\\n- Tom: direto")
    store.read_user()
    
    # Ambos (busca)
    store.read_all()  # global + user merged

Backend storage eh FILE-BASED (markdown) por design:
  - Trivial backup (cp -r)
  - Versionamento via git-friendly diff
  - Search global via ripgrep ou grep
  - Migration entre versions do Hermes eh facil
"""

from __future__ import annotations
import os
import re
import sys
from datetime import datetime
from pathlib import Path
from typing import Literal

from graphify_backend import TENANT_ID_PATTERN, USER_ID_PATTERN


Scope = Literal["global", "user"]


class MemoryStoreError(Exception):
    """Erro de operacao do MemoryStore."""


class MemoryStore:
    """Backend de memoria dual (global + user). File-based."""

    def __init__(
        self,
        tenant_id: str | None = None,
        user_id: str | None = None,
        data_dir: str | None = None,
    ):
        """
        Args:
            tenant_id: Empresa/workspace ID
            user_id: User UUID (Supabase). None = sem memoria privada
            data_dir: Diretorio raiz. Default: $NEXUS_MEMORY_DIR ou /opt/data/memory
        """
        self.tenant_id = self._validate(tenant_id, "tenant_id", TENANT_ID_PATTERN)
        self.user_id = self._validate(user_id, "user_id", USER_ID_PATTERN, required=False)

        # Resolver data_dir
        base = data_dir or os.environ.get("NEXUS_MEMORY_DIR", "/opt/data/memory")
        if self.tenant_id:
            base = os.path.join(base, f"tenant_{self.tenant_id}")
        self.data_dir = Path(base)
        # Diretories
        self.global_path = self.data_dir / "global.md"
        self.user_dir = self.data_dir / "users" / self.user_id if self.user_id else None
        self.user_path = self.user_dir / "memory.md" if self.user_dir else None

        # Lazy mkdir - so criar diretorios no write_*()

    @staticmethod
    def _validate(value, name: str, pattern, required: bool = True):
        if value is None:
            if required:
                raise MemoryStoreError(name + " eh obrigatorio")
            return None
        if not pattern.match(value):
            raise MemoryStoreError(
                name + " invalido: " + str(value) + " (esperado: " + str(pattern.pattern) + ")"
            )
        return value

    def write_global(self, content: str, merge: bool = False) -> str:
        """Escreve memoria global (team knowledge).

        Args:
            content: Markdown a ser escrito
            merge: True = adiciona timestamp + linha (preserva historico).
                  False = sobrescreve.
        """
        if not self.tenant_id:
            raise MemoryStoreError("tenant_id required for global memory")
        self.global_path.parent.mkdir(parents=True, exist_ok=True)

        if merge and self.global_path.exists():
            timestamp = datetime.utcnow().isoformat()
            with open(self.global_path, "a", encoding="utf-8") as f:
                f.write(f"\\n## {timestamp}\\n\\n{content}\\n")
            return f"merged into {self.global_path}"

        with open(self.global_path, "w", encoding="utf-8") as f:
            f.write(content)
        return f"wrote {len(content)} bytes to {self.global_path}"

    def read_global(self) -> str | None:
        """Le memoria global. Retorna None se nao existir."""
        if not self.global_path.exists():
            return None
        return self.global_path.read_text(encoding="utf-8")

    def write_user(self, content: str, merge: bool = False) -> str:
        """Escreve memoria PRIVADA do user. Requer user_id."""
        if not self.user_id:
            raise MemoryStoreError(
                "user_id required for private memory. "
                "Check if X-User-Id header is being sent."
            )
        if not self.user_path:
            raise MemoryStoreError("user_path not initialized")

        if merge and self.user_path.exists():
            timestamp = datetime.utcnow().isoformat()
            with open(self.user_path, "a", encoding="utf-8") as f:
                f.write(f"\\n## {timestamp}\\n\\n{content}\\n")
            return f"merged into {self.user_path}"

        self.user_path.parent.mkdir(parents=True, exist_ok=True)
        with open(self.user_path, "w", encoding="utf-8") as f:
            f.write(content)
        return f"wrote {len(content)} bytes to {self.user_path}"

    def read_user(self) -> str | None:
        """Le memoria privada do user."""
        if not self.user_path or not self.user_path.exists():
            return None
        return self.user_path.read_text(encoding="utf-8")

    def read_all(self) -> dict[str, str | None]:
        """Le TODAS as memorias (global + user). Retorna dict."""
        return {
            "global": self.read_global(),
            "user": self.read_user(),
            "tenant_id": self.tenant_id,
            "user_id": self.user_id,
        }

    def delete_user(self, confirm: str = "DELETE") -> bool:
        """Deleta memoria privada do user (irreversivel)."""
        if not self.user_id or not self.user_path:
            return False
        if confirm != "DELETE":
            raise MemoryStoreError(
                "Deletion requires confirm='DELETE' (sent " + str(confirm) + ")"
            )
        if self.user_path.exists():
            self.user_path.unlink()
        return True

    def stats(self) -> dict:
        """Estatisticas de uso."""
        global_size = self.global_path.stat().st_size if self.global_path.exists() else 0
        user_size = self.user_path.stat().st_size if (self.user_path and self.user_path.exists()) else 0
        return {
            "tenant_id": self.tenant_id,
            "user_id": self.user_id,
            "global_bytes": global_size,
            "user_bytes": user_size,
            "data_dir": str(self.data_dir),
        }


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Nexus memory store CLI (v3.8+ multi-user)")
    sub = parser.add_subparsers(dest="cmd", required=True)

    # write
    p = sub.add_parser("write-global")
    p.add_argument("--tenant-id", required=True)
    p.add_argument("--content-file", help="Path to content file")
    p.add_argument("--merge", action="store_true")

    p = sub.add_parser("write-user")
    p.add_argument("--tenant-id", required=True)
    p.add_argument("--user-id", required=True)
    p.add_argument("--content-file", help="Path to content file")
    p.add_argument("--merge", action="store_true")

    # read
    p = sub.add_parser("read-global")
    p.add_argument("--tenant-id", required=True)

    p = sub.add_parser("read-user")
    p.add_argument("--tenant-id", required=True)
    p.add_argument("--user-id", required=True)

    p = sub.add_parser("stats")
    p.add_argument("--tenant-id", required=True)
    p.add_argument("--user-id")

    p = sub.add_parser("delete-user")
    p.add_argument("--tenant-id", required=True)
    p.add_argument("--user-id", required=True)
    p.add_argument("--confirm", default="", help="Must be 'DELETE'")

    args = parser.parse_args()

    try:
        if args.cmd == "write-global":
            kwargs = {"tenant_id": args.tenant_id}
            content = Path(args.content_file).read_text() if args.content_file else sys.stdin.read()
            kwargs["merge"] = args.merge
            store = MemoryStore(**kwargs)
            print(store.write_global(content))
        elif args.cmd == "write-user":
            kwargs = {"tenant_id": args.tenant_id, "user_id": args.user_id}
            content = Path(args.content_file).read_text() if args.content_file else sys.stdin.read()
            kwargs["merge"] = args.merge
            store = MemoryStore(**kwargs)
            print(store.write_user(content))
        elif args.cmd == "read-global":
            store = MemoryStore(tenant_id=args.tenant_id)
            content = store.read_global()
            print(content if content else "(empty)")
        elif args.cmd == "read-user":
            store = MemoryStore(tenant_id=args.tenant_id, user_id=args.user_id)
            content = store.read_user()
            print(content if content else "(empty)")
        elif args.cmd == "stats":
            store = MemoryStore(tenant_id=args.tenant_id, user_id=args.user_id)
            import json
            print(json.dumps(store.stats(), indent=2))
        elif args.cmd == "delete-user":
            store = MemoryStore(tenant_id=args.tenant_id, user_id=args.user_id)
            print("deleted:", store.delete_user(confirm=args.confirm))
    except MemoryStoreError as e:
        print("ERROR: " + str(e), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
