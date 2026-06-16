"""
main.py — Layer 2: Orquestrador Nexus Designer (Nano Banana Pro)
======================================================
Entry point principal. Lê o input, carrega o contexto do template,
e orquestra a edição iterativa via Gemini 3 Pro (Nano Banana Pro).

Uso:
    python main.py --input input.json
"""

import argparse
import json
import re
import sys
import time
import os
import io
import logging
import shutil
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, Any, List, Tuple

from dotenv import load_dotenv
from pydantic import BaseModel, Field, field_validator
from google import genai
from google.genai import types
from PIL import Image, ImageChops, ImageDraw, ImageFilter

# Importação dos módulos de execução (mantendo compatibilidade onde possível)
from execution.select_template import TemplateNotFoundError, select_template
from execution.prompts import get_prompt

load_dotenv()

# Configuração de Logs
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("NexusOrchestrator")

EDITABLE_OUTPUT_SUFFIX = ".editable"
GLOBAL_COLOR_LOCK_RULES = [
    ("etiqueta_bg_white", "Etiqueta: fundo branco puro (#FFFFFF) e texto na cor principal do KV."),
    ("box1_bg_white", "Box1: fundo branco puro (#FFFFFF) e texto na cor principal do KV."),
    ("box2_text_white", "Box2: texto branco puro (#FFFFFF)."),
    ("title_phrase_white", "Título e frase: sempre branco puro (#FFFFFF)."),
]

# KVs que não possuem campo de título (a logo do KV ocupa o espaço do título).
# Para esses KVs, o formulário omite o campo Título e o pipeline não tenta editar título.
GLOBAL_KVS_SEM_TITULO: set = {"tudo-sobre-seguros"}
STEP2_PERSONA_BASE_ANCHOR_CONSTRAINTS = [
    "Manter a posição da persona coerente com a geometria do template atual, sem deslocar o sujeito principal para fora da área esperada.",
    "Não aplicar corte seco: preservar contexto visual ao redor da persona para evitar recortes abruptos de cabeça, tronco ou membros principais.",
    "Sem transparência, alpha, fade, ghosting ou lavagem na camada de persona/fundo.",
]
STEP2_PERSONA_CHANNEL_ANCHOR_RULES: Dict[str, List[str]] = {
    "02_story_instagram": [
        "Template vertical: preservar cabeça, ombros e tronco com enquadramento natural, sem crop agressivo no topo.",
    ],
    "04_banner_interno_mobile": [
        "Template vertical: manter composição estável entre coluna de texto e área de persona, sem invadir indevidamente a coluna esquerda.",
    ],
    "05_whatsapp": [
        "Template vertical: preservar cabeça, ombros e tronco com enquadramento natural, sem crop agressivo no topo.",
    ],
    "05_AIDA_whatsapp": [
        "Template vertical: preservar cabeça, ombros e tronco com enquadramento natural, sem crop agressivo no topo.",
    ],
}


def editable_output_path_for_delivery(delivery_path: Path) -> Path:
    return delivery_path.with_name(f"{delivery_path.stem}{EDITABLE_OUTPUT_SUFFIX}{delivery_path.suffix}")


def delivery_output_path_from_editable(editable_path: Path) -> Optional[Path]:
    marker = f"{EDITABLE_OUTPUT_SUFFIX}{editable_path.suffix}"
    if not editable_path.name.endswith(marker):
        return None
    base_name = editable_path.name[:-len(marker)]
    return editable_path.with_name(f"{base_name}{editable_path.suffix}")

# ---------------------------------------------------------------------------
# Schema de Validação do Input (Pydantic v2)
# ---------------------------------------------------------------------------

_VALID_KEY_RE = re.compile(r"^[a-zA-Z0-9_-]+$")

class RequestMeta(BaseModel):
    canal: str = Field(..., description="Canal de publicação (ex: 01_feed_instagram)", min_length=2, max_length=64)
    kv: str = Field(..., description="Key-visual / categoria (ex: graduacao, pos)", min_length=2, max_length=64)

    @field_validator("canal", "kv")
    @classmethod
    def validate_key(cls, v: str) -> str:
        value = v.strip()
        if not value:
            raise ValueError("Campo obrigatório não pode ser vazio.")
        if not _VALID_KEY_RE.match(value):
            raise ValueError("Formato inválido. Use letras, números, '_' ou '-'.")
        return value

class ContentKeys(BaseModel):
    etiqueta: str = Field(..., description="Etiqueta/badge superior", min_length=1, max_length=40)
    titulo: str = Field("", description="Headline principal (vazio para KVs sem título, ex: tudo-sobre-seguros)", min_length=0, max_length=80)
    frase: str = Field(..., description="Frase de apoio", min_length=1, max_length=160)
    box1: str = Field(..., description="Selo/destaque 1", min_length=1, max_length=120)
    box2: str = Field("", description="Selo/destaque 2 (opcional)", min_length=0, max_length=120)
    persona: str = Field(..., description="Descrição visual da persona/fundo", min_length=1, max_length=300)
    # Novo campo para caminho da imagem de persona (opcional, preenchido se upload for feito)
    persona_image_path: Optional[str] = Field(None, description="Caminho local para a imagem de persona enviada")

    @field_validator("frase", "etiqueta", "box1")
    @classmethod
    def must_not_be_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Campo obrigatório não pode ser vazio.")
        return v.strip()

    @field_validator("titulo", mode="before")
    @classmethod
    def normalize_titulo(cls, v) -> str:
        """Título é opcional para KVs sem título (ex: tudo-sobre-seguros). Aceita string vazia."""
        return (v or "").strip()

    @field_validator("box2", mode="before")
    @classmethod
    def normalize_box2(cls, v) -> str:
        return v or ""

class BannerRequest(BaseModel):
    request_meta: RequestMeta
    content_keys: ContentKeys

class StepValidationResult(BaseModel):
    status: str = Field(..., description="APROVADO ou CORREÇÃO")
    motivo: str = Field("", description="Motivo da correção")
    prompt_correcao: str = Field("", description="Prompt revisado para corrigir o problema")

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        value = (v or "").strip().upper()
        if value not in {"APROVADO", "CORREÇÃO", "CORRECAO"}:
            raise ValueError("status inválido")
        if value == "CORRECAO":
            return "CORREÇÃO"
        return value

    @field_validator("motivo", "prompt_correcao", mode="before")
    @classmethod
    def normalize_text(cls, v: Any) -> str:
        if v is None:
            return ""
        return str(v).strip()

# ---------------------------------------------------------------------------
# Classe Orquestradora
# ---------------------------------------------------------------------------

class NexusImageOrchestrator:
    def __init__(self):
        self.gemini_api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
        if not self.gemini_api_key:
            raise ValueError("GEMINI_API_KEY ou GOOGLE_API_KEY precisa estar definido.")

        self.max_retries = int(os.getenv("GENAI_MAX_RETRIES", "6"))
        self.retry_base_seconds = float(os.getenv("GENAI_RETRY_BASE_SECONDS", "3"))
        self.max_retries_resource_exhausted = int(os.getenv("GENAI_MAX_RETRIES_RESOURCE_EXHAUSTED", "2"))

        self.client = genai.Client(api_key=self.gemini_api_key)

        # Modelos
        self.refiner_model = os.getenv("GEMINI_REFINER_MODEL", "gemini-3-flash-preview")
        self.orchestrator_model = os.getenv("GEMINI_MODEL", self.refiner_model)
        self.image_model = os.getenv("IMAGEN_MODEL", "gemini-3-pro-image-preview")
        self.validator_model = os.getenv("GEMINI_VALIDATOR_MODEL", "gemini-3.1-pro-preview")
        self.image_size = os.getenv("IMAGE_SIZE", "4K")
        self.delivery_sharpen_radius = float(os.getenv("DELIVERY_SHARPEN_RADIUS", "0.6"))
        self.delivery_sharpen_percent = int(os.getenv("DELIVERY_SHARPEN_PERCENT", "120"))
        self.delivery_sharpen_threshold = int(os.getenv("DELIVERY_SHARPEN_THRESHOLD", "1"))
        self.image_aspect_ratio = os.getenv("IMAGE_ASPECT_RATIO", "1:1")
        self.image_client = self.client
        configured_step3_rounds = int(os.getenv("STEP3_MAX_CORRECTION_ROUNDS", "2"))
        self.max_step3_correction_rounds = max(1, min(2, configured_step3_rounds))
        self.enable_step1_planner = os.getenv("ENABLE_STEP1_PLANNER", "0").strip().lower() not in {"0", "false", "no"}
        self.enable_step2_planner = os.getenv("ENABLE_STEP2_PLANNER", "0").strip().lower() not in {"0", "false", "no"}
        self.enable_step3_planner = os.getenv("ENABLE_STEP3_PLANNER", "0").strip().lower() not in {"0", "false", "no"}
        self.enable_step3_persona_lock_validation = os.getenv("ENABLE_STEP3_PERSONA_LOCK_VALIDATION", "1").strip().lower() not in {"0", "false", "no"}
        self.planner_model = os.getenv("GEMINI_PLANNER_MODEL", self.orchestrator_model)
        self.executor_single_image_mode = os.getenv("EXECUTOR_SINGLE_IMAGE_MODE", "1").strip().lower() not in {"0", "false", "no"}

    def _should_retry(self, error: Exception) -> bool:
        msg = str(error)
        retry_tokens = [
            "503",
            "429",
            "UNAVAILABLE",
            "Deadline",
            "timeout",
            "Timeout",
            "RESOURCE_EXHAUSTED"
        ]
        return any(token in msg for token in retry_tokens)

    def _is_resource_exhausted_error(self, error: Exception) -> bool:
        msg = str(error)
        return "429" in msg and "RESOURCE_EXHAUSTED" in msg

    def _is_internal_server_error(self, error: Exception) -> bool:
        msg = str(error)
        return "500" in msg and "INTERNAL" in msg

    def _image_size_fallback_chain(self) -> List[Optional[str]]:
        normalized = (self.image_size or "").strip().upper()
        chain: List[Optional[str]] = []
        if normalized:
            chain.append(normalized)
        if normalized != "2K":
            chain.append("2K")
        chain.append(None)
        unique_chain: List[Optional[str]] = []
        for size in chain:
            if size not in unique_chain:
                unique_chain.append(size)
        return unique_chain

    def _call_genai_with_retry(self, *, model: str, contents: List[Any], config: Optional[types.GenerateContentConfig] = None):
        last_err: Optional[Exception] = None
        for attempt in range(self.max_retries):
            try:
                return self.client.models.generate_content(
                    model=model,
                    contents=contents,
                    config=config
                )
            except Exception as api_err:
                last_err = api_err
                if self._should_retry(api_err) and attempt < self.max_retries - 1:
                    wait_time = self.retry_base_seconds * (2 ** attempt)
                    logger.warning(
                        "Erro API (%s...). Tentativa %s/%s. Aguardando %ss...",
                        str(api_err)[:50],
                        attempt + 1,
                        self.max_retries,
                        int(wait_time)
                    )
                    time.sleep(wait_time)
                    continue
                if attempt < self.max_retries - 1:
                    time.sleep(1)
                    continue
                break
        if last_err:
            raise last_err
        raise RuntimeError("Falha desconhecida ao chamar o modelo.")

    def _sanitize_refined_text(self, text: str, max_length: int) -> str:
        if not isinstance(text, str):
            return ""
        cleaned = re.sub(r"\s+", " ", text).strip()
        cleaned = re.sub(r"^(prompt|descrição|descricao|solicitação|solicitacao)\s*[:\-]\s*", "", cleaned, flags=re.IGNORECASE)
        cleaned = cleaned.strip().strip("\"'").strip()
        if len(cleaned) > max_length:
            cleaned = cleaned[:max_length].rstrip()
        return cleaned

    def _is_human_persona_request(self, text: str) -> bool:
        if not isinstance(text, str):
            return False
        lowered = text.lower()
        if any(token in lowered for token in [
            "sem pessoa", "sem pessoas", "sem humano", "sem humanos", "sem gente",
            "sem personagem", "sem personagens", "sem presença humana", "ambiente vazio",
            "sala vazia", "sem ninguém", "sem ninguem"
        ]):
            return False
        human_tokens = [
            "pessoa", "pessoas", "humano", "humanos", "gente", "personagem", "personagens",
            "homem", "mulher", "menino", "menina", "jovem", "adulto", "idoso", "criança", "crianca",
            "estudante", "aluno", "professor", "executivo", "executiva", "profissional", "profissionais",
            "rosto", "mãos", "maos", "corpo", "retrato", "modelo", "fotografia de pessoa",
            "casal", "dupla", "time", "equipe", "negociando", "reunião", "reuniao", "apresentação", "apresentacao"
        ]
        return any(token in lowered for token in human_tokens)

    def _extract_requested_human_count(self, text: str) -> Optional[int]:
        if not isinstance(text, str):
            return None

        lowered = text.lower()
        word_to_number = {
            "um": 1,
            "uma": 1,
            "dois": 2,
            "duas": 2,
            "três": 3,
            "tres": 3,
            "quatro": 4,
        }

        numeric_pattern = re.search(
            r"\b(\d+)\s+(pessoas?|humanos?|homens?|mulheres?|personagens?|profissionais?|estudantes?)\b",
            lowered
        )
        if numeric_pattern:
            try:
                return max(1, int(numeric_pattern.group(1)))
            except Exception:
                return None

        word_pattern = re.search(
            r"\b(um|uma|dois|duas|três|tres|quatro)\s+(pessoas?|humanos?|homens?|mulheres?|personagens?|profissionais?|estudantes?)\b",
            lowered
        )
        if word_pattern:
            return word_to_number.get(word_pattern.group(1))

        if "homem e mulher" in lowered or "mulher e homem" in lowered:
            return 2
        if "duas pessoas" in lowered or "casal" in lowered or "dupla" in lowered:
            return 2

        return None

    def _looks_like_model_refusal(self, text: str) -> bool:
        lowered = (text or "").strip().lower()
        if not lowered:
            return False
        markers = [
            "i'm sorry",
            "i am sorry",
            "i cannot",
            "can't assist",
            "cannot assist",
            "não posso",
            "nao posso",
            "desculpe",
            "invalid_request",
        ]
        return any(marker in lowered for marker in markers)

    def _build_refiner_contents(self, user_message: str, layout_image_path: Optional[Path]) -> List[Any]:
        contents: List[Any] = [user_message]
        if not layout_image_path:
            return contents
        try:
            contents.append(Image.open(layout_image_path))
        except Exception as exc:
            logger.warning("Não foi possível anexar imagem de layout ao refinador: %s", exc)
        return contents

    def _refine_background_prompt(self, user_background_request: str, layout_image_path: Optional[Path] = None) -> str:
        system_prompt = (
            "Você é um especialista em direção de arte para fundos de banners corporativos e acadêmicos. "
            "Transforme a solicitação em um briefing visual detalhado de FUNDO SEM PESSOAS.\n"
            "Diretrizes:\n"
            "1. Não inclua pessoas, rostos, silhuetas, mãos ou personagens.\n"
            "2. Use elementos visuais coerentes com o tema: grafismos, arquitetura, paisagens urbanas, objetos ou textura.\n"
            "3. Evite textos, logos, números, marcas e tipografia.\n"
            "4. Descreva iluminação, clima e composição de fundo sem competir com o KV.\n"
            "5. O prompt deve ser em PORTUGUÊS e curto, objetivo e sem alucinações.\n"
            "6. NÃO descreva mudanças no KV, degradê, formas orgânicas, textos, boxes, ícones ou logotipo.\n"
            "7. NÃO mencione tipografia; a fonte Outfit deve permanecer intocada.\n"
            "8. Evite enquadramento fechado; preserve profundidade e leitura clara da cena.\n"
            "9. Considere que a imagem será aplicada na região de persona do banner: manter composição estável, sem zoom agressivo e sem corte do elemento principal."
        )

        user_message = (
            f"Solicitação do usuário: '{user_background_request}'. "
            "A imagem de layout anexada representa o Step 1 do banner (com textos e KV). "
            "Use essa referência visual para inferir orientação do template (horizontal/vertical) "
            "e posicionar o foco do fundo na área de persona sem close excessivo."
        )
        contents = self._build_refiner_contents(user_message, layout_image_path)

        try:
            response = self._call_genai_with_retry(
                model=self.refiner_model,
                contents=contents,
                config=types.GenerateContentConfig(
                    system_instruction=system_prompt,
                    temperature=0.6,
                    max_output_tokens=160,
                ),
            )
            refined_prompt = (response.text or "").strip()
            sanitized = self._sanitize_refined_text(refined_prompt, 260)
            if not sanitized:
                logger.warning("Prompt de fundo refinado inválido. Usando solicitação original.")
                return user_background_request
            if self._looks_like_model_refusal(sanitized):
                logger.warning("Refinador de fundo retornou recusa textual. Aplicando fallback para solicitação original.")
                return user_background_request
            if sanitized != refined_prompt:
                logger.info("Prompt de fundo refinado sanitizado por segurança.")
            logger.info(f"Prompt de Fundo refinado pelo Gemini Flash: {refined_prompt}")
            return sanitized
        except Exception as e:
            logger.error(f"Erro ao refinar prompt de fundo com Gemini Flash: {e}")
            return user_background_request

    def _refine_persona_prompt(self, user_persona_request: str, layout_image_path: Optional[Path] = None) -> str:
        """
        Refina o prompt da persona usando Gemini Flash para evitar alucinações e melhorar o realismo.
        """
        system_prompt = (
            "Você é um especialista em Prompt Engineering para geração de imagens fotorrealistas de personas corporativas e acadêmicas. "
            "Sua tarefa é transformar uma solicitação simples de persona em um prompt detalhado, natural e tecnicamente robusto.\n"
            "Diretrizes:\n"
            "1. Adicione detalhes de iluminação, pose, expressão facial e vestimenta adequados ao contexto (corporativo/estudantil).\n"
            "2. Garanta que a interação com objetos (notebooks, tablets) seja descrita de forma ergonômica e lógica.\n"
            "3. Evite descrições genéricas. Seja específico para guiar o modelo de imagem.\n"
            "4. O prompt deve ser em PORTUGUÊS.\n"
            "5. Mantenha o foco na persona e no fundo imediato, sem inventar elementos complexos que fujam do pedido original.\n"
            "6. NÃO descreva mudanças no KV, degradê, formas orgânicas, textos, boxes, ícones ou logotipo.\n"
            "7. NÃO mencione tipografia; a fonte Outfit deve permanecer intocada.\n"
            "8. Reforce fotorrealismo humano: pele com textura natural, poros sutis e iluminação realista.\n"
            "9. Proíba aparência de CGI, pele de borracha/plástica, rosto encerado ou traços artificiais.\n"
            "10. Especifique naturalidade facial: assimetrias leves, microtextura, transições suaves de luz e sombra.\n"
            "11. Especifique roupa e postura com coerência anatômica real.\n"
            "12. Trate a persona/fundo como camada de fundo final por trás do KV, sem alterar opacidade, degradê, overlays e grafismos frontais.\n"
            "13. Proíba qualquer resultado com transparência, alpha, vazamento da foto antiga, efeito vidro, fade ou ghosting.\n"
            "14. Evite close extremo; prefira enquadramento em plano médio ou americano para preservar contexto.\n"
            "15. A persona deve permanecer legível sem corte agressivo de cabeça, tronco ou membros principais.\n"
            "16. Retorne APENAS um parágrafo curto de prompt positivo, sem listas e sem aspas."
        )

        user_message = (
            f"Solicitação do usuário: '{user_persona_request}'. "
            "A imagem de layout anexada representa o Step 1 do banner (com textos e KV). "
            "Use essa referência para inferir orientação do template (horizontal/vertical) e posição provável da área de persona. "
            "Crie um prompt positivo de alta qualidade para fotorrealismo natural humano, com distância de câmera equilibrada."
        )
        requested_human_count = self._extract_requested_human_count(user_persona_request)
        if requested_human_count is not None:
            user_message += (
                f" Garanta presença explícita de {requested_human_count} pessoa(s) visível(is), "
                "sem substituir por cenário vazio."
            )
        contents = self._build_refiner_contents(user_message, layout_image_path)

        try:
            response = self._call_genai_with_retry(
                model=self.refiner_model,
                contents=contents,
                config=types.GenerateContentConfig(
                    system_instruction=system_prompt,
                    temperature=0.55,
                    max_output_tokens=240,
                ),
            )
            refined_prompt = (response.text or "").strip()
            sanitized = self._sanitize_refined_text(refined_prompt, 420)
            if not sanitized:
                logger.warning("Prompt refinado inválido. Usando persona original.")
                return user_persona_request
            if self._looks_like_model_refusal(sanitized):
                logger.warning("Refinador de persona retornou recusa textual. Aplicando fallback para solicitação original.")
                return user_persona_request
            if sanitized != refined_prompt:
                logger.info("Prompt refinado sanitizado por segurança.")
            logger.info(f"Prompt de Persona refinado pelo Gemini Flash: {refined_prompt}")
            return sanitized
        except Exception as e:
            logger.error(f"Erro ao refinar prompt de persona com Gemini Flash: {e}")
            return user_persona_request

    def _build_persona_negative_prompt(self) -> str:
        return (
            "pele plástica, rosto emborrachado, aparência de manequim, CGI, 3D render, cartoon, anime, ilustração, "
            "filtro de beleza, face smoothing, waxy skin, olhos artificiais, sorriso rígido, anatomia incorreta, "
            "mãos deformadas, dedos extras, texturas borradas, baixa definição de pele, recorte artificial, "
            "iluminação impossível, proporções faciais irreais, sala vazia, ambiente vazio, sem pessoas, sem presença humana"
        )

    def _refine_box_icon_prompt(self, box_text: str, box_id: str) -> str:
        """
        Gera um prompt de ícone contextual e refinado usando Gemini Flash baseado no texto da box.
        """
        system_prompt = (
            "Você é um designer de UI/UX especialista em iconografia e micro-layout de boxes para banners de marketing. "
            "Sua tarefa é analisar o texto de uma 'box' (chamada de destaque) e sugerir um ícone visualmente coerente e moderno.\n"
            "Diretrizes:\n"
            "1. Analise o texto e extraia o conceito chave (ex: 'Data' -> Calendário, 'Dinheiro' -> Cifrão, 'Novidade' -> Estrela/Brilho).\n"
            "2. Use APENAS ícones minimalistas, comuns e reconhecíveis (ex: calendário, etiqueta, estrela, escudo, relógio, livro, diploma, check).\n"
            "3. Retorne SOMENTE UM ícone. Nunca sugerir dois ícones para a mesma box.\n"
            "4. NÃO invente ícones e NÃO use números, letras ou textos dentro do ícone.\n"
            "5. Descreva o ícone de forma visual e precisa para um gerador de imagem (ex: 'ícone minimalista de calendário').\n"
            "6. O ícone deve ser simples, sem excesso de detalhes que causem borrões.\n"
            "7. Retorne APENAS a descrição do ícone em PORTUGUÊS, curta e direta (ex: 'ícone minimalista de estrela').\n"
            "8. O ícone será aplicado antes do texto (lado esquerdo), então priorize ícones compactos e legíveis."
        )

        user_message = f"Texto da box: '{box_text}'\nSugira um ícone para acompanhar este texto."

        try:
            response = self._call_genai_with_retry(
                model=self.refiner_model,
                contents=[user_message],
                config=types.GenerateContentConfig(
                    system_instruction=system_prompt,
                    temperature=0.5,
                    max_output_tokens=50,
                ),
            )
            icon_prompt = (response.text or "").strip()
            sanitized = self._sanitize_refined_text(icon_prompt, 120)
            if not sanitized:
                logger.warning("Prompt de ícone refinado inválido. Usando fallback.")
                return "atualize o ícone para combinar com o novo texto"
            if sanitized != icon_prompt:
                logger.info("Prompt de ícone refinado sanitizado por segurança.")
            logger.info(f"Prompt de Ícone ({box_id}) gerado pelo Gemini Flash: {icon_prompt}")
            return (
                f"atualize o ícone para um {sanitized}, preservando o tamanho da fonte e a altura da box. "
                "O ícone deve permanecer dentro da própria box, à esquerda do texto, com padding interno visível; "
                "é proibido criar ícone solto ou ícone externo à box. "
                "Ajuste a largura apenas o necessário para caber ícone + texto com o mesmo tamanho de fonte do template."
            )
        except Exception as e:
            logger.error(f"Erro ao gerar prompt de ícone com Gemini Flash: {e}")
            return (
                "atualize o ícone para combinar com o novo texto, preservando o tamanho da fonte e a altura da box. "
                "O ícone deve permanecer dentro da própria box, à esquerda do texto, com padding interno visível; "
                "é proibido criar ícone solto ou ícone externo à box. "
                "Ajuste a largura apenas o necessário para caber ícone + texto com o mesmo tamanho de fonte do template."
            )

    def load_template_context(self, template_path: Path) -> Dict[str, Any]:
        """Carrega o arquivo template_context.json da mesma pasta do template."""
        context_path = template_path.parent / "template_context.json"
        if not context_path.exists():
            logger.warning(f"Contexto não encontrado em {context_path}. Usando modo sem contexto.")
            return {}
        
        try:
            with open(context_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Erro ao ler template_context.json: {e}")
            return {}

    def _build_compact_context(self, context: Dict[str, Any], meta: RequestMeta) -> Dict[str, Any]:
        metadata = context.get("meta") if isinstance(context, dict) else {}
        compact = {
            "template_id": f"{meta.canal}/{meta.kv}",
            "kv_guidelines": [],
            "overlay_rules": [],
            "background_rules": [],
            "do_not_change_zones": [],
            "hard_locks": {
                "logos": ["ENS", "AIDA_BRASIL"],
                "must_preserve": ["logo_ens_assinatura", "logo_aida_brasil", "rodape", "degrade_principal", "overlays_organicos"]
            }
        }
        if isinstance(metadata, dict):
            for key in ("kv_guidelines", "overlay_rules", "background_rules"):
                value = metadata.get(key)
                if isinstance(value, list):
                    compact[key] = [v for v in value if isinstance(v, str)]
                elif isinstance(value, str):
                    compact[key] = [value]
            zones = metadata.get("do_not_change_zones")
            if isinstance(zones, list):
                for zone in zones:
                    if not isinstance(zone, dict):
                        continue
                    compact["do_not_change_zones"].append(
                        {
                            "zone_id": zone.get("zone_id"),
                            "description": zone.get("description"),
                            "lock": bool(zone.get("lock", True)),
                        }
                    )
        return compact

    def _resolve_template_path_for_meta(self, meta: RequestMeta) -> Optional[Path]:
        try:
            template_path = select_template(meta.canal, meta.kv)
            final_template_path = template_path.parent / "Template (final).png"
            if final_template_path.exists():
                return final_template_path
            return template_path
        except Exception:
            return None

    def _load_template_planner_base_payload(self, template_path: Optional[Path]) -> Dict[str, Any]:
        if not template_path:
            return {}
        payload_path = template_path.parent / "planner_payloads" / "context_json_padrao.json"
        if not payload_path.exists():
            return {}
        try:
            data = json.loads(payload_path.read_text(encoding="utf-8"))
            return data if isinstance(data, dict) else {}
        except Exception:
            return {}

    def _default_color_lock_policy(self) -> Dict[str, Any]:
        return {
            "enabled": True,
            "allow_exceptions": False,
            "exceptions": [],
        }

    def _normalize_color_lock_exceptions(self, raw_value: Any) -> List[str]:
        allowed_ids = {rule_id for rule_id, _ in GLOBAL_COLOR_LOCK_RULES}
        if not isinstance(raw_value, list):
            return []
        normalized: List[str] = []
        for item in raw_value:
            if not isinstance(item, str):
                continue
            key = item.strip()
            if key in allowed_ids:
                normalized.append(key)
        return normalized

    def _resolve_color_lock_policy(
        self,
        template_path: Optional[Path],
        step_payload: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        policy = self._default_color_lock_policy()
        base_payload = self._load_template_planner_base_payload(template_path)
        planner_policy = base_payload.get("planner_policy") if isinstance(base_payload, dict) else {}
        base_color_policy = planner_policy.get("color_lock_policy") if isinstance(planner_policy, dict) else {}
        if isinstance(base_color_policy, dict):
            policy.update(base_color_policy)

        planner_overrides = step_payload.get("planner_overrides") if isinstance(step_payload, dict) else {}
        step_color_policy = planner_overrides.get("color_lock_policy") if isinstance(planner_overrides, dict) else {}
        if isinstance(step_color_policy, dict):
            policy.update(step_color_policy)

        policy["enabled"] = bool(policy.get("enabled", True))
        policy["allow_exceptions"] = bool(policy.get("allow_exceptions", False))
        policy["exceptions"] = self._normalize_color_lock_exceptions(policy.get("exceptions"))
        if not policy["allow_exceptions"]:
            policy["exceptions"] = []
        return policy

    def _build_color_lock_instruction_lines(self, policy: Dict[str, Any]) -> List[str]:
        if not bool(policy.get("enabled", True)):
            return []
        exceptions = set(policy.get("exceptions", [])) if bool(policy.get("allow_exceptions", False)) else set()
        lines = [
            "REGRA GLOBAL DE COR (OBRIGATÓRIA): preservar branco puro (#FFFFFF) sem desvio para creme/bege/cinza/off-white/marfim.",
            "Não aplicar filtro quente, color grading, sombra amarelada ou warm tint sobre elementos brancos do KV.",
            "Em box com fundo branco, o fundo permanece #FFFFFF; texto e ícone seguem a cor principal do KV, sem serem convertidos para branco.",
        ]
        for rule_id, rule_text in GLOBAL_COLOR_LOCK_RULES:
            if rule_id in exceptions:
                continue
            lines.append(rule_text)
        return lines

    def _build_color_lock_hard_constraints(self, policy: Dict[str, Any]) -> List[str]:
        if not bool(policy.get("enabled", True)):
            return []
        constraints: List[str] = []
        for line in self._build_color_lock_instruction_lines(policy):
            constraints.append(line)
        constraints.append("Se houver desvio de branco para creme/off-white, corrigir de volta para #FFFFFF.")
        return constraints

    def _build_step2_persona_anchor_constraints(self, canal: str) -> List[str]:
        constraints = list(STEP2_PERSONA_BASE_ANCHOR_CONSTRAINTS)
        constraints.extend(STEP2_PERSONA_CHANNEL_ANCHOR_RULES.get(canal or "", []))
        return constraints

    def _planner_output_schema(self, allow_validation_decision: bool = False) -> Dict[str, Any]:
        properties: Dict[str, Any] = {
            "status": {"type": "string", "enum": ["OK", "BLOCK"]},
            "goal": {"type": "string"},
            "allowed_changes": {"type": "array", "items": {"type": "string"}},
            "forbidden_changes": {"type": "array", "items": {"type": "string"}},
            "edit_prompt_final": {"type": "string"},
            "confidence": {"type": "number"},
            "notes": {"type": "string"},
        }
        if allow_validation_decision:
            properties["decision"] = {"type": "string", "enum": ["APROVADO", "CORREÇÃO"]}
            properties["correction_prompt_final"] = {"type": "string"}
        return {
            "type": "object",
            "properties": properties,
            "required": ["status", "edit_prompt_final"],
        }

    def _build_step_planner_system_prompt(self, step_name: str) -> str:
        base_guardrails = (
            "Você é um Planner AI de edição de banners.\n"
            "Responda APENAS JSON válido no schema exigido.\n"
            "Prioridade de decisão: 1) imagem de referência atual, 2) pedido do usuário, 3) context_json_compacto como guardrail.\n"
            "Nunca invente alterações fora de escopo.\n"
            "Não gerar prompt gigante; objetivo, curto e executável.\n"
        )
        prompts = {
            "step1_text": (
                "Tarefa do Step 1: planejar alteração APENAS de textos e boxes.\n"
                "Proibido alterar persona/fundo, logos, rodapé, degradê, overlays e grafismos.\n"
                "Preserve tipografia, alinhamento e legibilidade geral.\n"
            ),
            "step2_persona": (
                "Tarefa do Step 2: planejar alteração APENAS de persona/fundo.\n"
                "Proibido alterar textos, boxes, logos, rodapé, degradê e overlays.\n"
                "Evite close extremo e resíduos da persona anterior.\n"
            ),
            "step3_validation": (
                "Tarefa do Step 3 Planner: converter diagnóstico do validador em correction_prompt_final curto.\n"
                "NÃO decidir qualidade sozinho se não houver diagnóstico; respeitar decisão do validador.\n"
                "Proibido pedir regressão para template/original e proibido mudar persona/fundo.\n"
            ),
        }
        return base_guardrails + prompts.get(step_name, "")

    def _ensure_template_planner_payloads(
        self,
        template_path: Path,
        meta: RequestMeta,
        context: Dict[str, Any]
    ) -> Path:
        payload_dir = template_path.parent / "planner_payloads"
        payload_dir.mkdir(parents=True, exist_ok=True)
        context_padrao_path = payload_dir / "context_json_padrao.json"
        compact_context = self._build_compact_context(context, meta)
        base_context_payload = {
            "meta": {
                "version": 1,
                "template_id": f"{meta.canal}/{meta.kv}",
                "canal": meta.canal,
                "kv": meta.kv,
            },
            "planner_policy": {
                "prefer_image_truth_over_json": True,
                "max_prompt_chars": 1200,
                "on_conflict": "block_or_fallback",
                "color_lock_policy": {
                    "enabled": True,
                    "allow_exceptions": False,
                    "exceptions": []
                }
            },
            "hard_locks": compact_context.get("hard_locks", {}),
            "soft_hints": {
                "composition": "manter estrutura visual do template",
                "distance": "evitar close extremo sem corte agressivo",
            },
            "editable_fields": {
                "step1": ["etiqueta", "titulo", "frase", "box1", "box2"],
                "step2": ["persona"],
                "step3": ["apenas critérios reprovados pelo validador"],
            },
            "kv_guidelines": compact_context.get("kv_guidelines", []),
            "overlay_rules": compact_context.get("overlay_rules", []),
            "background_rules": compact_context.get("background_rules", []),
            "do_not_change_zones": compact_context.get("do_not_change_zones", []),
        }
        if not context_padrao_path.exists():
            context_padrao_path.write_text(json.dumps(base_context_payload, ensure_ascii=False, indent=2), encoding="utf-8")

        step_payload_templates = {
            "step1_planner_payload.json": {
                "step": "step1_text",
                "hard_constraints": [
                    "Não alterar logos ENS/AIDA, rodapé e degradê.",
                    "Alterar apenas textos/boxes solicitados."
                ]
            },
            "step2_planner_payload.json": {
                "step": "step2_persona",
                "hard_constraints": [
                    "Não alterar textos, boxes, logos, rodapé, degradê e overlays.",
                    "Trocar somente persona/fundo na área de persona."
                ]
            },
            "step3_planner_payload.json": {
                "step": "step3_validation",
                "hard_constraints": [
                    "Não regredir para template original.",
                    "Não alterar persona quando validando/corrigindo KV e boxes."
                ]
            },
        }
        for file_name, payload in step_payload_templates.items():
            full_path = payload_dir / file_name
            if full_path.exists():
                continue
            payload_content = {
                "template_id": f"{meta.canal}/{meta.kv}",
                "output_contract": {
                    "status": "OK|BLOCK",
                    "goal": "string",
                    "allowed_changes": ["..."],
                    "forbidden_changes": ["..."],
                    "edit_prompt_final": "prompt curto e executável",
                    "confidence": 0.0,
                    "notes": "string"
                },
                "context_json_compacto": compact_context,
                "context_json_raw_path": str((template_path.parent / "template_context.json").resolve()),
                "reference_images": [],
                **payload,
            }
            full_path.write_text(json.dumps(payload_content, ensure_ascii=False, indent=2), encoding="utf-8")
        return payload_dir

    def _run_planner_step(
        self,
        *,
        step_name: str,
        user_request: str,
        context: Dict[str, Any],
        meta: RequestMeta,
        reference_images: List[Path],
        fallback_prompt: str,
        template_path: Optional[Path] = None,
        allow_validation_decision: bool = False
    ) -> Dict[str, Any]:
        compact_context = self._build_compact_context(context, meta)
        step_payload = self._load_template_step_payload(template_path, step_name)
        payload_compact = step_payload.get("context_json_compacto")
        if isinstance(payload_compact, dict):
            compact_context = payload_compact

        planner_instructions = self._build_step_planner_system_prompt(step_name)
        planner_overrides = step_payload.get("planner_overrides") if isinstance(step_payload, dict) else {}
        extra_rules = planner_overrides.get("extra_system_rules") if isinstance(planner_overrides, dict) else None
        if isinstance(extra_rules, list):
            normalized_rules = [rule.strip() for rule in extra_rules if isinstance(rule, str) and rule.strip()]
            if normalized_rules:
                planner_instructions += "\nRegras extras do payload do template:\n- " + "\n- ".join(normalized_rules) + "\n"

        hard_constraints = []
        payload_constraints = step_payload.get("hard_constraints") if isinstance(step_payload, dict) else None
        if isinstance(payload_constraints, list):
            hard_constraints.extend([item for item in payload_constraints if isinstance(item, str) and item.strip()])
        if step_name == "step2_persona":
            hard_constraints.extend(self._build_step2_persona_anchor_constraints(meta.canal))
        color_lock_policy = self._resolve_color_lock_policy(template_path, step_payload=step_payload)
        hard_constraints.extend(self._build_color_lock_hard_constraints(color_lock_policy))
        payload = {
            "step": step_name,
            "template_id": f"{meta.canal}/{meta.kv}",
            "user_request": user_request,
            "context_json_compacto": compact_context,
            "hard_locks": compact_context.get("hard_locks", {}),
            "hard_constraints": hard_constraints,
        }
        contents: List[Any] = [planner_instructions, json.dumps(payload, ensure_ascii=False)]
        for image_path in reference_images:
            try:
                contents.append(Image.open(image_path))
            except Exception:
                logger.warning("Planner %s sem imagem de referência válida em %s", step_name, image_path)
        try:
            response = self._call_genai_with_retry(
                model=self.planner_model,
                contents=contents,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_json_schema=self._planner_output_schema(allow_validation_decision=allow_validation_decision),
                ),
            )
            raw = (response.text or "").strip()
            data = json.loads(raw) if raw else {}
            if not isinstance(data, dict):
                raise ValueError("Resposta do planner inválida")
            planner_status = (data.get("status") or "").strip().upper()
            final_prompt = self._sanitize_refined_text(data.get("edit_prompt_final", ""), 1800)
            if planner_status == "BLOCK" or self._looks_like_model_refusal(final_prompt):
                logger.warning("Planner %s retornou BLOCK/recusa. Aplicando fallback legado.", step_name)
                final_prompt = fallback_prompt
                data["status"] = "OK"
            if not final_prompt:
                final_prompt = fallback_prompt
            data["edit_prompt_final"] = final_prompt
            if template_path:
                traces_dir = Path("temp") / "planner_traces"
                traces_dir.mkdir(parents=True, exist_ok=True)
                trace_path = traces_dir / f"{meta.canal}_{meta.kv}_{step_name}.json"
                trace_path.write_text(json.dumps({"input": payload, "output": data}, ensure_ascii=False, indent=2), encoding="utf-8")
            return data
        except Exception as exc:
            logger.warning("Planner %s falhou. Aplicando fallback legado: %s", step_name, exc)
            return {
                "status": "OK",
                "goal": "fallback_legado",
                "allowed_changes": [],
                "forbidden_changes": [],
                "edit_prompt_final": fallback_prompt,
                "confidence": 0.0,
                "notes": f"fallback por erro planner: {exc}",
            }

    def _load_template_step_payload(self, template_path: Optional[Path], step_name: str) -> Dict[str, Any]:
        if not template_path:
            return {}
        payload_dir = template_path.parent / "planner_payloads"
        file_map = {
            "step1_text": "step1_planner_payload.json",
            "step2_persona": "step2_planner_payload.json",
            "step3_validation": "step3_planner_payload.json",
        }
        file_name = file_map.get(step_name)
        if not file_name:
            return {}
        payload_path = payload_dir / file_name
        if not payload_path.exists():
            return {}
        try:
            data = json.loads(payload_path.read_text(encoding="utf-8"))
            return data if isinstance(data, dict) else {}
        except Exception as exc:
            logger.warning("Falha ao carregar payload do planner %s: %s", payload_path, exc)
            return {}

    def _build_template_kv_guidance(self, context: Dict[str, Any], meta: RequestMeta) -> str:
        descriptions: List[str] = []
        if isinstance(context, dict):
            for field in ("etiqueta", "titulo", "frase", "box1", "box2"):
                item = context.get(field)
                if isinstance(item, dict):
                    desc = item.get("descricao_visual")
                    if isinstance(desc, str) and desc.strip():
                        descriptions.append(desc.strip())

        metadata = context.get("meta") if isinstance(context, dict) else None
        custom_rules: List[str] = []
        if isinstance(metadata, dict):
            for key in ("kv_rules", "kv_guidelines", "overlay_rules", "background_rules"):
                value = metadata.get(key)
                if isinstance(value, str) and value.strip():
                    custom_rules.append(value.strip())
                if isinstance(value, list):
                    for item in value:
                        if isinstance(item, str) and item.strip():
                            custom_rules.append(item.strip())

        blob = " ".join(descriptions + custom_rules)
        color_codes = sorted(set(re.findall(r"#[0-9a-fA-F]{6}", blob)))
        orientation_keywords = [
            "lateral", "horizontal", "vertical", "diagonal", "radial",
            "superior", "inferior", "esquerda", "direita", "centro"
        ]
        lowered_blob = blob.lower()
        detected_orientation = [kw for kw in orientation_keywords if kw in lowered_blob]

        lines = [
            f"Template ativo: '{meta.canal}/{meta.kv}'. Preserve integralmente o KV original desse template.",
            "A direção, posição e intensidade do degradê/overlay devem permanecer exatamente como no template original.",
            "As formas orgânicas, enquadramento e hierarquia visual do KV não podem ser alteradas."
        ]
        if color_codes:
            lines.append(
                "A paleta do KV deve permanecer idêntica ao template, incluindo os tons de referência: "
                + ", ".join(color_codes) + "."
            )
        if detected_orientation:
            lines.append(
                "Referências de orientação detectadas no contexto visual do template: "
                + ", ".join(detected_orientation) + "."
            )
        if custom_rules:
            lines.append(
                "Restrições específicas do template: " + " | ".join(custom_rules) + "."
            )
        return "\n".join(lines)

    def _build_step3_validator_prompt(self, context: Dict[str, Any], meta: RequestMeta, keys: Optional[ContentKeys] = None) -> str:
        metadata = context.get("meta") if isinstance(context, dict) else {}
        kv_palette = metadata.get("kv_palette") if isinstance(metadata, dict) else {}
        kv_palette_json = json.dumps(kv_palette, ensure_ascii=False)
        context_json = json.dumps(context, ensure_ascii=False)
        text_lock_guardrails = self._build_step3_text_lock_guardrails(context, keys)
        template_path = self._resolve_template_path_for_meta(meta)
        step_payload = self._load_template_step_payload(template_path, "step3_validation")
        color_lock_policy = self._resolve_color_lock_policy(template_path, step_payload=step_payload)
        color_lock_lines = self._build_color_lock_instruction_lines(color_lock_policy)
        color_lock_validator_clause = ""
        color_lock_correction_clause = ""
        if color_lock_lines:
            color_lock_validator_clause = (
                "10) Integridade de branco puro (#FFFFFF): auditar etiqueta, título, frase e boxes conforme regra de cor do template. "
                "Reprovar qualquer desvio de branco para creme, bege, cinza ou off-white.\n"
            )
            color_lock_correction_clause = (
                "No prompt_correcao, se houver desvio de branco para creme, exigir restaurar branco puro (#FFFFFF) "
                "nos elementos reprovados.\n"
            )
        text_shadow_validator_clause = (
            "11) Sombra em título/frase: reprovar qualquer sombreamento/drop shadow aplicado em título e frase. "
            "Textos devem permanecer chapados, sem sombra.\n"
        )
        text_shadow_correction_clause = (
            "No prompt_correcao, se detectar sombra em título/frase, remover qualquer sombreamento do título e da frase.\n"
        )
        return (
            "Você é um auditor de Key Visual para banners ENS. E deve fazer briefing de ajuste simples e direto no que necessitar ser ajustado após sua analise.\n"
            "Analise a IMAGEM_BASE_TEMPLATE e a IMAGEM_GERADA_STEP2 junto com o CONTEXTO_JSON.\n"
            "Valide de forma unificada degradê, logotipo e boxes com base nos critérios críticos.\n"
            "REGRA INVIOLÁVEL: persona/fundo estão congelados no Step 3 e NÃO podem ser alterados.\n"
            "É PROIBIDO sugerir, solicitar ou descrever qualquer troca de pessoa, rosto, pose, roupa, cenário, objetos de fundo, enquadramento da persona ou iluminação da persona.\n"
            "1) Degradê do KV INVIOLÁVEL: Compare a área de cobertura e a cor exata do degradê (overlay) da imagem gerada com o template base. A cor NÃO DEVE ser alterada e deve bater com as cores definidas na Palette do KV. O degradê deve cobrir a mesma proporção da imagem que o original. Reprovar se o degradê estiver recuado, deixando a etiqueta, título ou frase sem fundo. Reprovar se a cor for alterada, lavado ou transparente. Comparar matiz/saturação/brilho para detectar desvio sutil de cor do KV.\n"
            "2) Logotipo: preservar posição, proporção, nitidez e fidelidade visual. Reprovar se estiver deformado, borrado, deslocado ou alterado.\n"
            "2.1) Grafismos orgânicos dos cantos: preservar exatamente os grafismos/bolhas/formas orgânicas do topo esquerdo e canto inferior direito. Reprovar se forem removidos, recortados, deslocados, deformados, suavizados em excesso ou tiverem opacidade alterada.\n"
            "3) Organização das boxes por largura útil: use a largura visual da FRASE (linha acima das boxes) como limite horizontal de referência para decidir a disposição. Se a soma visual de box1 + box2 + espaçamento (incluindo ícones e padding) ultrapassar esse limite, as boxes devem ficar empilhadas verticalmente. Se não ultrapassar, as boxes podem ficar lado a lado. Não reprovar apenas por diferença de orientação em relação ao template quando essa regra for respeitada.\n"
            "4) Estilo independente box1/box2: respeitar a lógica visual de cada box como no template. Box1 é a box branca do layout quando esse estilo for exigido pelo template e deve permanecer como box branca. Box2 não é branca; deve preservar a lógica visual do template, incluindo contorno, preenchimento e cores derivadas da cor do KV. Reprovar se ficarem idênticas quando o template for distinto. Quando o template exigir box2 com contorno vazado, manter box2 com contorno vazado e sem preenchimento sólido, incluindo cantos arredondados conforme referência. Reprovar se box2 for convertida em caixa branca sólida quando o template exigir box com contorno/estilo do KV.\n"
            "5) Ícones obrigatórios e internos: cada box deve conter exatamente 1 ícone dentro da própria box, sempre à esquerda do texto, com padding interno visível. Reprovar se faltar ícone, se o ícone estiver fora da box ou à direita do texto.\n"
            "6) Linha única e largura justa (compacta): texto de box1 e box2 deve ficar sempre em uma única linha. Reprovar se houver quebra de linha. IMPORTANTE: A largura da box deve ser apenas o suficiente para conter o ícone e o texto. Reprovar se a box estiver muito larga, sobrando espaço vazio excessivo nas laterais.\n"
            "7) Alinhamento interno do conteúdo da box: ícone e texto devem seguir o alinhamento interno do template, mantendo centralização vertical e espaçamentos coerentes.\n"
            "8) Harmonia macro do bloco textual: auditar etiqueta, título, frase, box1 e box2 como conjunto editorial. Manter espaçamento vertical entre etiqueta, título e frase sem colidir ou abrir buracos exagerados. Reprovar título longo espremido em uma linha quando o template/canal tiver largura útil para quebrar o título em até 2 linhas equilibradas. Reprovar título ou frase pequenos demais, grandes demais, desalinhados, com espaçamento fraco ou com hierarquia visual pior que o template. É permitido ajuste leve de escala, entrelinha e espaçamento vertical em etiqueta/título/frase para harmonizar, preservando fonte, peso, cor, conteúdo textual, tamanho de fonte das boxes e geometria do KV.\n"
            "9) Boxes residuais/fantasma: reprovar se existir box extra indevida, box duplicada/sobreposta, vestígio parcial de box antiga ou qualquer box residual que não pertença ao layout final esperado.\n"
            f"{color_lock_validator_clause}"
            f"{text_shadow_validator_clause}"
            f"Contexto do template ativo: canal={meta.canal}, kv={meta.kv}.\n"
            f"Palette do KV (MUITO IMPORTANTE PARA O DEGRADÊ): {kv_palette_json}.\n"
            f"{text_lock_guardrails}"
            f"CONTEXTO_JSON: {context_json}\n"
            + (("Regras globais de cor a auditar:\n- " + "\n- ".join(color_lock_lines) + "\n") if color_lock_lines else "")
            +
            "Retorne apenas JSON válido no formato:\n"
            "{\"status\":\"APROVADO\"}\n"
            "ou\n"
            "{\"status\":\"CORREÇÃO\",\"motivo\":\"...\",\"prompt_correcao\":\"...\"}\n"
            "PROTOCOLO OBRIGATÓRIO DE DECISÃO:\n"
            "- Avalie cada critério (1..9) separadamente como APROVADO ou REPROVADO.\n"
            "- Se todos estiverem APROVADOS, retorne apenas {\"status\":\"APROVADO\"}.\n"
            "- Se houver REPROVAÇÃO, o prompt_correcao deve conter SOMENTE os ajustes dos critérios reprovados.\n"
            "- É PROIBIDO pedir ajuste de critério já aprovado.\n"
            "- Persona/fundo são fora de escopo no Step 3: jamais incluir instruções sobre persona/fundo no prompt_correcao.\n"
            "- Grafismos orgânicos dos cantos são fora de escopo de alteração criativa: se estiverem corretos, jamais pedir remoção, reposicionamento ou redesenho.\n"
            "- Se somente boxes falharem, não mencionar degradê ou logotipo.\n"
            "- Se somente degradê/logotipo falharem, não mencionar boxes.\n"
            "- Se somente degradê/logotipo/grafismos falharem, não mencionar boxes.\n"
            "- Se falharem ambos (KV e boxes), incluir ambos no prompt_correcao.\n"
            "Se retornar CORREÇÃO, o prompt_correcao deve ser autossuficiente e executável, sem depender de instruções extras.\n"
            "O prompt_correcao será aplicado usando somente a IMAGEM_GERADA_STEP2, sem envio da imagem template para a etapa de edição.\n"
            "Portanto, descreva ajustes direcionados com base na sua comparação com template/contexto, cobrindo apenas critérios reprovados.\n"
            "No prompt_correcao, se for erro de degradê, especifique de qual direção ele deve vir (ex: 'aumentar a área do degradê lateral esquerdo' ou 'subir o degradê inferior') para cobrir o título/frase corretamente, E especifique a cor exata usando a Palette do KV fornecida.\n"
            "No prompt_correcao, se a reprovação for apenas box1 e/ou box2 por largura excessiva, focar exclusivamente nessas boxes, sem mencionar persona, fundo, degradê, logotipo ou qualquer critério já aprovado.\n"
            "No prompt_correcao, se for erro de largura de box1, usar uma instrução dedicada e autossuficiente focada só na box1, no estilo: Include a tight, short white rectangular pill-shaped box containing the text 'TEXTO DA BOX'. The white box must be narrow, closely wrapping the text without extra horizontal space on the sides.\n"
            "No prompt_correcao, se for erro de largura de box2, usar uma instrução dedicada e autossuficiente focada só na box2. Não transformar a box2 em box branca. Preservar o estilo do template: box2 não é branca, deve manter contorno, preenchimento e cor do KV, ficando justa ao redor do ícone e do texto, sem espaço lateral excessivo.\n"
            "No prompt_correcao, se houver falha de harmonia macro do bloco textual, pedir somente rediagramar etiqueta/título/frase/boxes como conjunto: quebrar o título em até 2 linhas equilibradas quando necessário, aplicar ajuste leve de escala, entrelinha e espaçamento vertical em etiqueta/título/frase, preservar EXPECTED_TEXTS e não alterar KV, persona, logotipo, grafismos, cores, estilo ou tamanho de fonte das boxes.\n"
            "Quando box1/box2 tiverem textos maiores, é permitido adaptar largura, empilhamento e espaçamento local das boxes para manter harmonia e legibilidade, sem interferir no KV.\n"
            "No prompt_correcao, se grafismos dos cantos estiverem corretos, explicite que devem permanecer intocados.\n"
            f"{color_lock_correction_clause}"
            f"{text_shadow_correction_clause}"
            "No prompt_correcao, não copiar qualquer texto do template e não reverter textos já atualizados da peça gerada."
        )

    def _run_step3_validation(
        self,
        stage_label: str,
        prompt: str,
        base_template_path: Path,
        generated_image_path: Path,
    ) -> StepValidationResult:
        schema = {
            "type": "object",
            "properties": {
                "status": {"type": "string", "enum": ["APROVADO", "CORREÇÃO"]},
                "motivo": {"type": "string"},
                "prompt_correcao": {"type": "string"}
            },
            "required": ["status"]
        }
        try:
            base_image = Image.open(base_template_path)
            generated_image = Image.open(generated_image_path)
            response = self._call_genai_with_retry(
                model=self.validator_model,
                contents=[prompt, base_image, generated_image],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_json_schema=schema
                )
            )
            raw = (response.text or "").strip()
            if not raw:
                return StepValidationResult(status="CORREÇÃO", motivo="Resposta vazia da validação", prompt_correcao="")
            data = json.loads(raw)
            return StepValidationResult(**data)
        except Exception as e:
            logger.warning("%s falhou. Seguindo fluxo sem bloqueio rígido: %s", stage_label, e)
            return StepValidationResult(status="APROVADO", motivo="fallback por erro na validação", prompt_correcao="")

    def _validate_step3_output(
        self,
        base_template_path: Path,
        generated_image_path: Path,
        context: Dict[str, Any],
        meta: RequestMeta,
        keys: Optional[ContentKeys] = None
    ) -> StepValidationResult:
        prompt = self._build_step3_validator_prompt(context, meta, keys)
        return self._run_step3_validation("Validação Step 3", prompt, base_template_path, generated_image_path)

    def _validate_step3_1_output(
        self,
        base_template_path: Path,
        generated_image_path: Path,
        context: Dict[str, Any],
        meta: RequestMeta
    ) -> StepValidationResult:
        return self._validate_step3_output(base_template_path, generated_image_path, context, meta)

    def _validate_step3_2_output(
        self,
        base_template_path: Path,
        generated_image_path: Path,
        context: Dict[str, Any],
        meta: RequestMeta
    ) -> StepValidationResult:
        return self._validate_step3_output(base_template_path, generated_image_path, context, meta)

    def _validate_step2_output(
        self,
        base_template_path: Path,
        generated_image_path: Path,
        context: Dict[str, Any],
        meta: RequestMeta
    ) -> StepValidationResult:
        return self._validate_step3_output(base_template_path, generated_image_path, context, meta)

    def _run_single_image_validation(
        self,
        stage_label: str,
        prompt: str,
        generated_image_path: Path,
    ) -> StepValidationResult:
        schema = {
            "type": "object",
            "properties": {
                "status": {"type": "string", "enum": ["APROVADO", "CORREÇÃO"]},
                "motivo": {"type": "string"},
                "prompt_correcao": {"type": "string"}
            },
            "required": ["status"]
        }
        try:
            generated_image = Image.open(generated_image_path)
            response = self._call_genai_with_retry(
                model=self.validator_model,
                contents=[prompt, generated_image],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_json_schema=schema
                )
            )
            raw = (response.text or "").strip()
            if not raw:
                return StepValidationResult(status="CORREÇÃO", motivo="Resposta vazia da validação", prompt_correcao="")
            data = json.loads(raw)
            return StepValidationResult(**data)
        except Exception as e:
            logger.warning("%s falhou. Seguindo fluxo sem bloqueio rígido: %s", stage_label, e)
            return StepValidationResult(status="APROVADO", motivo="fallback por erro na validação", prompt_correcao="")

    def _build_text_lock_validator_prompt(
        self,
        locked_fields: List[Tuple[str, str]],
        meta: RequestMeta
    ) -> str:
        expected_text_json = json.dumps({field: value for field, value in locked_fields}, ensure_ascii=False)
        return (
            "Você é um auditor de integridade textual para banners ENS.\n"
            "Analise a IMAGEM_GERADA e compare com EXPECTED_TEXTS.\n"
            "EXPECTED_TEXTS é a fonte da verdade textual e deve ser respeitado exatamente.\n"
            "Considere acentos, pontuação, maiúsculas e conteúdo integral de cada campo.\n"
            "Se qualquer campo estiver diferente, truncado, revertido para template antigo ou ausente, reprovar.\n"
            f"Contexto do template ativo: canal={meta.canal}, kv={meta.kv}.\n"
            f"EXPECTED_TEXTS: {expected_text_json}\n"
            "Retorne apenas JSON válido no formato:\n"
            "{\"status\":\"APROVADO\"}\n"
            "ou\n"
            "{\"status\":\"CORREÇÃO\",\"motivo\":\"...\",\"prompt_correcao\":\"...\"}\n"
            "Se retornar CORREÇÃO, o prompt_correcao deve restaurar apenas textos obrigatórios sem alterar KV, boxes, logotipo, persona, degradê e geometria."
        )

    def _validate_text_lock_output(
        self,
        generated_image_path: Path,
        context: Dict[str, Any],
        meta: RequestMeta,
        keys: Optional[ContentKeys] = None
    ) -> StepValidationResult:
        locked_fields = self._collect_locked_fields(context, keys)
        if not locked_fields:
            return StepValidationResult(status="APROVADO", motivo="sem textos obrigatórios", prompt_correcao="")
        prompt = self._build_text_lock_validator_prompt(locked_fields, meta)
        return self._run_single_image_validation("Validação Text Lock", prompt, generated_image_path)

    def _build_step3_persona_lock_prompt(self, meta: RequestMeta) -> str:
        return (
            "Você é um auditor de continuidade visual de persona/fundo para banners ENS.\n"
            "Compare IMAGEM_ANTES_STEP3 e IMAGEM_DEPOIS_STEP3.\n"
            "A correção Step 3 só deveria ajustar KV, degradê, logotipo, grafismos ou boxes. "
            "Persona/fundo devem permanecer com qualidade igual ou melhor.\n"
            "Ignore mudanças em textos, boxes e elementos do KV, exceto quando contaminarem a persona/fundo.\n"
            "Reprovar se a persona/fundo depois tiver saturação excessiva, color grading agressivo, borrado, "
            "pele artificial/borracha, aparência plástica, face smoothing, humanos deformados, mãos/rostos piores, "
            "perda de nitidez, textura de pele degradada ou iluminação incoerente.\n"
            f"Contexto do template ativo: canal={meta.canal}, kv={meta.kv}.\n"
            "Retorne apenas JSON válido no formato:\n"
            "{\"status\":\"APROVADO\"}\n"
            "ou\n"
            "{\"status\":\"CORREÇÃO\",\"motivo\":\"...\",\"prompt_correcao\":\"DESCARTAR_CORRECAO_STEP3\"}"
        )

    def _validate_step3_persona_lock_output(
        self,
        before_step3_image_path: Path,
        after_step3_image_path: Path,
        meta: RequestMeta
    ) -> StepValidationResult:
        prompt = self._build_step3_persona_lock_prompt(meta)
        return self._run_step3_validation(
            "Validação Persona Lock Step 3",
            prompt,
            before_step3_image_path,
            after_step3_image_path
        )

    def _generate_prompt(self, field: str, new_value: str, context_item: Dict[str, str], current_image_path: Path) -> str:
        """
        Gera um prompt otimizado para inpainting de alta fidelidade.
        O prompt funciona como um wrapper técnico que traduz a intenção do usuário
        para instruções precisas de preservação e renderização de texto.
        """
        current_text = context_item.get("texto_atual", "")
        visual_desc = context_item.get("descricao_visual", "")
        
        # Se não tivermos imagem ou contexto, fallback para prompt simples
        if not current_image_path.exists():
            return f"Substitua o texto '{current_text}' por '{new_value}'."

        try:
            image = Image.open(current_image_path)
            
            # Instrução de Sistema Refinada para Inpainting Estrito e PRESERVAÇÃO
            prompt_instruction = (
                f"Atue como um especialista em Prompt Engineering para inpainting de imagens. "
                f"Sua tarefa é criar um prompt de edição que PRIORIZE A PRESERVAÇÃO VISUAL ABSOLUTA do original. "
                f"\n\n"
                f"CONTEXTO DA EDIÇÃO:\n"
                f"- Elemento Alvo: Texto '{current_text}' ({visual_desc})\n"
                f"- Novo Valor: '{new_value}'\n"
                f"\n\n"
                f"REGRAS OBRIGATÓRIAS DO PROMPT FINAL (EM INGLÊS):\n"
                f"1. O objetivo é APENAS substituir o texto, mantendo o resto da imagem INTACTO.\n"
                f"2. Use termos de preservação extrema: 'Seamlessly blend text', 'Match exact font style', 'Preserve original background texture'.\n"
                f"3. PROIBIDO: Não use termos de 'melhoria' como 'High fidelity', 'Sharp focus', 'Professional photography', '4k', 'Vivid colors'.\n"
                f"4. Ordene explicitamente: 'Do NOT change the color palette', 'Do NOT change the orange tonality', 'Do NOT sharpen', 'Do NOT apply filters'.\n"
                f"5. Evite texto falhado. Se o traço parecer fino, aumente levemente a espessura para legibilidade, sem mudar estilo.\n"
                f"6. O texto final deve ser '{new_value}' (respeite acentos).\n"
                f"\n\n"
                f"Retorne APENAS o prompt técnico em inglês, curto e direto, sem aspas."
            )
            
            response = self._call_genai_with_retry(
                model=self.orchestrator_model,
                contents=[prompt_instruction, image]
            )
            
            generated_prompt = response.text.strip()
            logger.info(f"Prompt Técnico gerado para '{field}': {generated_prompt}")
            return generated_prompt
            
        except Exception as e:
            logger.warning(f"Falha ao usar Gemini Vision para prompt ({e}). Usando fallback estático.")
            return (
                f"Replace the text '{current_text}' with '{new_value}'. "
                f"Keep the exact same font, style, and color. "
                f"Do NOT change the background or the orange color. "
                f"Do NOT sharpen or enhance the image."
            )

    def _safe_image_size(self, image: Image.Image) -> Tuple[int, int]:
        size = getattr(image, "size", None)
        if not isinstance(size, tuple) or len(size) != 2:
            return (1024, 1024)
        try:
            width = int(size[0])
            height = int(size[1])
        except Exception:
            return (1024, 1024)
        if width <= 0 or height <= 0:
            return (1024, 1024)
        return (width, height)

    def _read_dimensions_from_file(self, image_path: Path) -> Tuple[int, int]:
        try:
            image = Image.open(image_path)
            return self._safe_image_size(image)
        except Exception as e:
            logger.warning(f"Falha ao ler dimensões de {image_path}: {e}. Usando fallback 1024x1024.")
            return (1024, 1024)

    def _persist_editable_output(self, source_path: Path, delivery_path: Path) -> Path:
        editable_path = editable_output_path_for_delivery(delivery_path)
        shutil.copy(source_path, editable_path)
        logger.info(f"Base sem resize persistida para ajustes manuais em: {editable_path}")
        return editable_path

    def _resolve_adjustment_target_size(self, image_path: Path) -> Tuple[int, int]:
        delivery_path = delivery_output_path_from_editable(image_path)
        if delivery_path and delivery_path.exists():
            return self._read_dimensions_from_file(delivery_path)
        return self._read_dimensions_from_file(image_path)

    def _postprocess_final_resolution(self, source_path: Path, target_size: Tuple[int, int], output_path: Path) -> Path:
        image = Image.open(source_path)
        source_w, source_h = self._safe_image_size(image)
        target_w, target_h = target_size
        if target_w <= 0 or target_h <= 0:
            target_w, target_h = source_w, source_h

        if (source_w, source_h) == (target_w, target_h):
            shutil.copy(source_path, output_path)
            logger.info(f"Pós-processamento de resolução não necessário. Mantida dimensão {source_w}x{source_h}.")
            return output_path

        use_downsampling = target_w <= source_w and target_h <= source_h
        if use_downsampling:
            resample_filter = Image.Resampling.LANCZOS
        else:
            resample_filter = Image.Resampling.BICUBIC

        try:
            resized = image.resize((target_w, target_h), resample=resample_filter, reducing_gap=3.0)
        except TypeError:
            resized = image.resize((target_w, target_h), resample=resample_filter)

        if use_downsampling:
            resized = resized.filter(ImageFilter.UnsharpMask(
                radius=self.delivery_sharpen_radius,
                percent=self.delivery_sharpen_percent,
                threshold=self.delivery_sharpen_threshold,
            ))

        save_kwargs: Dict[str, Any] = {}
        if output_path.suffix.lower() == ".png":
            save_kwargs["compress_level"] = 1
        elif output_path.suffix.lower() in {".jpg", ".jpeg"}:
            save_kwargs.update({"quality": 100, "subsampling": 0})

        resized.save(output_path, **save_kwargs)
        logger.info(
            "Pós-processamento de resolução aplicado: %sx%s -> %sx%s (template %sx%s) em %s",
            source_w,
            source_h,
            target_w,
            target_h,
            target_size[0],
            target_size[1],
            output_path,
        )
        return output_path

    def _get_image_aspect_ratio(self, width: int, height: int) -> str:
        try:
            ratio = width / height
            supported_ratios = {
                "1:1": 1.0,
                "16:9": 1.77,
                "9:16": 0.56,
                "4:5": 0.8,
                "5:4": 1.25,
                "3:4": 0.75,
                "4:3": 1.33,
                "21:9": 2.33,
                "3:2": 1.5,
                "2:3": 0.66
            }
            closest_ratio = min(supported_ratios.keys(), key=lambda k: abs(supported_ratios[k] - ratio))
            logger.info(f"Aspect Ratio detectado: {closest_ratio} (original: {width}x{height})")
            return closest_ratio
        except Exception as e:
            logger.warning(f"Erro ao detectar Aspect Ratio: {e}. Usando 1:1.")
            return "1:1"

    def _parse_bbox(self, bbox: Any) -> Optional[Tuple[int, int, int, int]]:
        if not isinstance(bbox, (list, tuple)) or len(bbox) != 4:
            return None
        try:
            x, y, w, h = [int(round(float(v))) for v in bbox]
        except Exception:
            return None
        if w <= 0 or h <= 0:
            return None
        return (x, y, w, h)

    def _clamp_bbox(self, bbox: Tuple[int, int, int, int], image_size: Tuple[int, int], padding: int = 0) -> Optional[Tuple[int, int, int, int]]:
        x, y, w, h = bbox
        img_w, img_h = image_size
        left = max(0, x - padding)
        top = max(0, y - padding)
        right = min(img_w, x + w + padding)
        bottom = min(img_h, y + h + padding)
        if right <= left or bottom <= top:
            return None
        return (left, top, right, bottom)

    def _crop_roi(self, image: Image.Image, bbox: Tuple[int, int, int, int], padding: int = 0) -> Tuple[Optional[Image.Image], Optional[Tuple[int, int, int, int]]]:
        size = self._safe_image_size(image)
        clamped = self._clamp_bbox(bbox, size, padding)
        if not clamped:
            return None, None
        return image.crop(clamped), clamped

    def _paste_roi(self, base_image: Image.Image, roi_image: Image.Image, crop_box: Tuple[int, int, int, int]) -> Image.Image:
        left, top, right, bottom = crop_box
        target_w = max(1, right - left)
        target_h = max(1, bottom - top)
        if roi_image.size != (target_w, target_h):
            roi_image = roi_image.resize((target_w, target_h))
        base_image.paste(roi_image, (left, top))
        return base_image

    def _extract_generated_image(
        self,
        response: Any,
        *,
        base_image: Optional[Image.Image] = None,
        stabilize_output: bool = True,
    ) -> Image.Image:
        def _finalize(generated: Image.Image) -> Image.Image:
            if stabilize_output and base_image is not None:
                return self._stabilize_generated_alpha(base_image, generated)
            return generated.convert("RGB")

        if hasattr(response, 'parts'):
            for part in response.parts:
                if part.inline_data:
                    image_bytes = part.inline_data.data
                    generated = Image.open(io.BytesIO(image_bytes))
                    return _finalize(generated)

        if hasattr(response, 'candidates') and response.candidates:
            for part in response.candidates[0].content.parts:
                if part.inline_data:
                    image_bytes = part.inline_data.data
                    generated = Image.open(io.BytesIO(image_bytes))
                    return _finalize(generated)

        if hasattr(response, "generated_images") and response.generated_images:
            generated = response.generated_images[0].image
            return _finalize(generated)

        raise RuntimeError("Nenhuma imagem retornada pela API.")

    def _call_image_model(
        self,
        image: Image.Image,
        prompt: str,
        mask: Optional[Image.Image] = None,
        reference_images: Optional[List[Image.Image]] = None
    ) -> Image.Image:
        width, height = self._safe_image_size(image)
        aspect_ratio = self._get_image_aspect_ratio(width, height)
        max_retries = self.max_retries
        last_err: Optional[Exception] = None
        image_size_chain = self._image_size_fallback_chain()
        for size_index, image_size_str in enumerate(image_size_chain):
            for attempt in range(max_retries):
                try:
                    contents = [prompt, image]
                    if reference_images:
                        contents = [prompt, image, *reference_images]
                    if mask is not None:
                        contents.append(mask)

                    image_config_kwargs: Dict[str, Any] = {"aspect_ratio": aspect_ratio}
                    if image_size_str:
                        image_config_kwargs["image_size"] = image_size_str

                    response = self.image_client.models.generate_content(
                        model=self.image_model,
                        contents=contents,
                        config=types.GenerateContentConfig(
                            response_modalities=["IMAGE"],
                            image_config=types.ImageConfig(**image_config_kwargs)
                        ),
                    )

                    return self._extract_generated_image(
                        response,
                        base_image=image,
                        stabilize_output=True,
                    )

                except Exception as api_err:
                    last_err = api_err
                    error_str = str(api_err)

                    if self._is_resource_exhausted_error(api_err):
                        if attempt >= self.max_retries_resource_exhausted - 1:
                            break
                        wait_time = self.retry_base_seconds * (2 ** attempt)
                        logger.warning(
                            "Quota esgotada (%s...). Tentativa %s/%s para 429. Aguardando %ss...",
                            error_str[:50],
                            attempt + 1,
                            self.max_retries_resource_exhausted,
                            int(wait_time)
                        )
                        time.sleep(wait_time)
                        continue

                    if self._should_retry(api_err) and attempt < max_retries - 1:
                        wait_time = self.retry_base_seconds * (2 ** attempt)
                        logger.warning(
                            "Erro API (%s...). Tentativa %s/%s. Aguardando %ss...",
                            error_str[:50],
                            attempt + 1,
                            max_retries,
                            int(wait_time)
                        )
                        time.sleep(wait_time)
                        continue

                    if "image_size" in error_str or "Invalid" in error_str:
                        break

                    if attempt < max_retries - 1:
                        time.sleep(2)
                        continue
                    break

            if size_index < len(image_size_chain) - 1 and last_err is not None:
                if self._is_internal_server_error(last_err) or "image_size" in str(last_err) or "Invalid" in str(last_err):
                    next_size = image_size_chain[size_index + 1]
                    if next_size:
                        logger.warning("Fallback de geração de imagem ativado: trocando image_size para %s.", next_size)
                    else:
                        logger.warning("Fallback de geração de imagem ativado: removendo image_size e mantendo apenas aspect_ratio.")
                    continue
            break
        
        if last_err:
            raise last_err
        raise RuntimeError("Falha desconhecida na geração de imagem.")

    def _call_image_model_raw_adjustment(self, image: Image.Image, prompt: str) -> Image.Image:
        width, height = self._safe_image_size(image)
        aspect_ratio = self._get_image_aspect_ratio(width, height)
        last_err: Optional[Exception] = None

        for attempt in range(self.max_retries):
            try:
                response = self.image_client.models.generate_content(
                    model=self.image_model,
                    contents=[prompt, image],
                    config=types.GenerateContentConfig(
                        response_modalities=["IMAGE"],
                        image_config=types.ImageConfig(
                            aspect_ratio=aspect_ratio,
                            image_size="4K",
                        ),
                    ),
                )
                return self._extract_generated_image(
                    response,
                    base_image=image,
                    stabilize_output=False,
                )
            except Exception as api_err:
                last_err = api_err
                if self._should_retry(api_err) and attempt < self.max_retries - 1:
                    wait_time = self.retry_base_seconds * (2 ** attempt)
                    logger.warning(
                        "Erro API no ajuste manual cru (%s...). Tentativa %s/%s. Aguardando %ss...",
                        str(api_err)[:50],
                        attempt + 1,
                        self.max_retries,
                        int(wait_time)
                    )
                    time.sleep(wait_time)
                    continue
                break

        if last_err:
            raise last_err
        raise RuntimeError("Falha desconhecida no ajuste manual cru.")

    def _stabilize_generated_alpha(self, base_image: Image.Image, generated_image: Image.Image) -> Image.Image:
        if not isinstance(base_image, Image.Image) or not isinstance(generated_image, Image.Image):
            return generated_image
        if generated_image.mode not in ("RGBA", "LA") and "A" not in generated_image.getbands():
            return generated_image.convert("RGB")
        base_rgba = base_image.convert("RGBA")
        generated_rgba = generated_image.convert("RGBA")
        if generated_rgba.size != base_rgba.size:
            generated_rgba = generated_rgba.resize(base_rgba.size)
        return Image.alpha_composite(base_rgba, generated_rgba).convert("RGB")

    def _build_composite_mask(self, image_size: Tuple[int, int], bbox: Tuple[int, int, int, int], padding: int = 0) -> Optional[Image.Image]:
        clamped = self._clamp_bbox(bbox, image_size, padding)
        if not clamped:
            return None
        left, top, right, bottom = clamped
        mask = Image.new("L", image_size, 0)
        draw = ImageDraw.Draw(mask)
        draw.rectangle([left, top, right, bottom], fill=255)
        return mask

    def _build_union_mask(self, image_size: Tuple[int, int], bboxes: List[Tuple[int, int, int, int]], padding: int = 0) -> Optional[Image.Image]:
        if not bboxes:
            return None
        mask = Image.new("L", image_size, 0)
        draw = ImageDraw.Draw(mask)
        for bbox in bboxes:
            clamped = self._clamp_bbox(bbox, image_size, padding)
            if not clamped:
                continue
            left, top, right, bottom = clamped
            draw.rectangle([left, top, right, bottom], fill=255)
        return mask

    def _edit_image_masked(self, image_path: Path, prompt: str, output_path: Path, bbox: Tuple[int, int, int, int], padding: int = 6) -> Path:
        logger.info(f"Executando edição full-canvas com composição local: {prompt}")
        image = Image.open(image_path).convert("RGBA")
        mask = self._build_composite_mask(self._safe_image_size(image), bbox, padding)
        if mask is None:
            logger.warning("Máscara inválida. Pulando edição.")
            return image_path
        full_prompt = (
            f"{prompt}\n"
            "Edit ONLY the specified area. Keep everything outside the target area unchanged."
        )
        edited = self._call_image_model(image, full_prompt).convert("RGBA")
        if edited.size != image.size:
            edited = edited.resize(image.size)
        composed = Image.composite(edited, image, mask)
        composed.save(output_path)
        logger.info(f"Imagem composta por máscara salva em {output_path}")
        return output_path

    def _compose_persona_from_raw(
        self,
        base_image_path: Path,
        raw_persona_image_path: Path,
        output_path: Path,
        *,
        diff_threshold: int = 20,
        upper_region_ratio: float = 0.66,
        min_changed_ratio: float = 0.002
    ) -> Path:
        base_image = Image.open(base_image_path).convert("RGB")
        raw_image = Image.open(raw_persona_image_path).convert("RGB")
        if raw_image.size != base_image.size:
            raw_image = raw_image.resize(base_image.size, resample=Image.Resampling.LANCZOS)

        width, height = base_image.size
        diff = ImageChops.difference(base_image, raw_image).convert("L")
        binary_mask = diff.point(lambda p: 255 if p >= diff_threshold else 0, mode="L")
        upper_limit = max(1, int(height * upper_region_ratio))
        region_mask = Image.new("L", (width, height), 0)
        region_mask.paste(255, (0, 0, width, upper_limit))
        binary_mask = ImageChops.multiply(binary_mask, region_mask)
        binary_mask = binary_mask.filter(ImageFilter.MedianFilter(size=3))
        binary_mask = binary_mask.filter(ImageFilter.GaussianBlur(radius=0.8))

        changed_hist = binary_mask.point(lambda p: 255 if p >= 24 else 0, mode="1").histogram()
        changed_pixels = changed_hist[255] if len(changed_hist) > 255 else 0
        changed_ratio = changed_pixels / max(1, width * upper_limit)
        if changed_ratio < min_changed_ratio:
            raw_image.save(output_path)
            logger.info(
                "Composição de persona ignorada por baixa diferença detectada (ratio=%.5f). Mantendo raw.",
                changed_ratio
            )
            return output_path

        composed = Image.composite(raw_image, base_image, binary_mask)
        composed.save(output_path)
        logger.info(
            "Composição isolada da persona aplicada (threshold=%s, upper_region_ratio=%.2f, changed_ratio=%.5f).",
            diff_threshold,
            upper_region_ratio,
            changed_ratio
        )
        return output_path

    def _is_persona_region_degraded(
        self,
        before_image_path: Path,
        after_image_path: Path,
        *,
        diff_threshold: int = 22,
        max_changed_ratio: float = 0.018
    ) -> bool:
        try:
            before = Image.open(before_image_path).convert("RGB")
            after = Image.open(after_image_path).convert("RGB")
            if after.size != before.size:
                after = after.resize(before.size, resample=Image.Resampling.LANCZOS)
            width, height = before.size
            left = int(width * 0.06)
            right = int(width * 0.94)
            top = int(height * 0.03)
            bottom = int(height * 0.58)
            if right <= left or bottom <= top:
                return False
            before_roi = before.crop((left, top, right, bottom))
            after_roi = after.crop((left, top, right, bottom))
            diff = ImageChops.difference(before_roi, after_roi).convert("L")
            changed = diff.point(lambda p: 255 if p >= diff_threshold else 0, mode="1")
            histogram = changed.histogram()
            changed_pixels = histogram[255] if len(histogram) > 255 else 0
            total_pixels = max(1, before_roi.size[0] * before_roi.size[1])
            changed_ratio = changed_pixels / total_pixels
            return changed_ratio > max_changed_ratio
        except Exception:
            return False

    def _is_global_overcorrection(
        self,
        before_image_path: Path,
        after_image_path: Path,
        *,
        diff_threshold: int = 24,
        max_changed_ratio: float = 0.60
    ) -> bool:
        try:
            before = Image.open(before_image_path).convert("RGB")
            after = Image.open(after_image_path).convert("RGB")
            if after.size != before.size:
                after = after.resize(before.size, resample=Image.Resampling.LANCZOS)
            diff = ImageChops.difference(before, after).convert("L")
            changed = diff.point(lambda p: 255 if p >= diff_threshold else 0, mode="1")
            histogram = changed.histogram()
            changed_pixels = histogram[255] if len(histogram) > 255 else 0
            total_pixels = max(1, before.size[0] * before.size[1])
            changed_ratio = changed_pixels / total_pixels
            return changed_ratio > max_changed_ratio
        except Exception:
            return False

    def _apply_locks(self, pre_image_path: Path, post_image_path: Path, lock_bboxes: List[Dict[str, Any]], output_path: Path) -> Path:
        pre_image = Image.open(pre_image_path).convert("RGBA")
        post_image = Image.open(post_image_path).convert("RGBA")
        for item in lock_bboxes:
            bbox = None
            if isinstance(item, dict):
                bbox = self._parse_bbox(item.get("bbox"))
            else:
                bbox = self._parse_bbox(item)
            if not bbox:
                continue
            roi, crop_box = self._crop_roi(pre_image, bbox, 0)
            if roi is None or crop_box is None:
                continue
            post_image = self._paste_roi(post_image, roi, crop_box)
        post_image.save(output_path)
        logger.info(f"Locks aplicados. Imagem salva em {output_path}")
        return output_path

    def _scale_bbox(self, bbox: Tuple[int, int, int, int], base_size: Tuple[int, int], target_size: Tuple[int, int]) -> Tuple[int, int, int, int]:
        base_w, base_h = base_size
        target_w, target_h = target_size
        if base_w <= 0 or base_h <= 0:
            return bbox
        if (base_w, base_h) == (target_w, target_h):
            return bbox
        scale_x = target_w / base_w
        scale_y = target_h / base_h
        left, top, right, bottom = bbox
        return (
            int(round(left * scale_x)),
            int(round(top * scale_y)),
            int(round(right * scale_x)),
            int(round(bottom * scale_y))
        )

    def _resolve_bbox_for_layer(self, raw_bbox: Any, base_size: Tuple[int, int], layer_size: Tuple[int, int]) -> Optional[Tuple[int, int, int, int]]:
        parsed = self._parse_bbox(raw_bbox)
        if not parsed:
            return None
        return self._scale_bbox(parsed, base_size, layer_size)

    def _resolve_template_layers(self, template_path: Path) -> Dict[str, Path]:
        template_dir = template_path.parent
        final_path = template_dir / "Template (final).png"
        text_path = template_dir / "Template Texto.png"
        persona_path = template_dir / "Template Persona.png"
        return {
            "final": final_path if final_path.exists() else template_path,
            "text": text_path if text_path.exists() else template_path,
            "persona": persona_path if persona_path.exists() else template_path
        }

    def _compose_text_over_persona(self, persona_path: Path, text_path: Path, output_path: Path, bboxes: List[Tuple[int, int, int, int]]) -> Path:
        try:
            persona = Image.open(persona_path).convert("RGBA")
            text_layer = Image.open(text_path).convert("RGBA")
            if text_layer.size != persona.size:
                text_layer = text_layer.resize(persona.size)
            mask = self._build_union_mask(text_layer.size, bboxes, padding=2)
            if mask is None:
                composed = Image.alpha_composite(persona, text_layer)
            else:
                composed = Image.composite(text_layer, persona, mask)
            composed.save(output_path)
            return output_path
        except Exception:
            return text_path

    def _suggest_icon_concept(self, text: str) -> Optional[str]:
        prompt = (
            "You are an icon selector. Based on the text, return a JSON object only. "
            "Format: {\"icon\":\"<short concept>\"} or {\"icon\":\"\"} if no icon fits. "
            "Use short lowercase English words, max 2 words."
            f"\nText: {text}"
        )
        try:
            response = self._call_genai_with_retry(
                model=self.orchestrator_model,
                contents=[prompt]
            )
            raw = (response.text or "").strip()
            data = json.loads(raw)
            icon = str(data.get("icon", "")).strip().lower()
            if not icon:
                return None
            if not re.match(r"^[a-z0-9 ]{1,20}$", icon):
                return None
            return icon
        except Exception:
            return None

    def _estimate_text_width(self, current_text: str, current_width: int, new_text: str) -> int:
        if current_width <= 0:
            return max(1, len(new_text) * 10)
        current_len = max(1, len(current_text.strip()))
        new_len = max(1, len(new_text.strip()))
        avg = current_width / current_len
        return max(1, int(round(avg * new_len)))

    def _resize_box(self, image_path: Path, box_context: Dict[str, Any], new_text: str, keep_icon: bool, temp_dir: Path, field: str, base_size: Tuple[int, int]) -> Tuple[Path, Dict[str, Tuple[int, int, int, int]]]:
        image = Image.open(image_path)
        img_w, img_h = self._safe_image_size(image)
        bbox_full = self._resolve_bbox_for_layer(box_context.get("bbox_full"), base_size, (img_w, img_h))
        bbox_text = self._resolve_bbox_for_layer(box_context.get("bbox_text"), base_size, (img_w, img_h))
        bbox_icon = self._resolve_bbox_for_layer(box_context.get("bbox_icon"), base_size, (img_w, img_h))
        if not bbox_full or not bbox_text:
            return image_path, {}
        box_x, box_y, box_w, box_h = bbox_full
        text_x, text_y, text_w, text_h = bbox_text
        current_text = str(box_context.get("texto_atual", "") or "")

        padding_left = max(0, text_x - box_x)
        padding_right = max(0, (box_x + box_w) - (text_x + text_w))
        text_offset = padding_left
        icon_offset = None
        icon_w = 0
        gap = 0

        if keep_icon and bbox_icon:
            icon_x, icon_y, icon_w, icon_h = bbox_icon
            icon_offset = max(0, icon_x - box_x)
            gap = max(0, text_x - (icon_x + icon_w))
            text_offset = icon_offset + icon_w + gap
        elif not keep_icon and bbox_icon:
            icon_x, icon_y, icon_w, icon_h = bbox_icon
            text_offset = max(0, icon_x - box_x)

        new_text_w = self._estimate_text_width(current_text, text_w, new_text)
        target_w = text_offset + new_text_w + padding_right
        max_w = max(1, img_w - box_x - 1)
        target_w = max(1, min(target_w, max_w))
        min_w = max(1, text_offset + new_text_w + padding_right)
        target_w = max(min_w, target_w)

        if target_w == box_w:
            return image_path, {
                "bbox_full": bbox_full,
                "bbox_text": bbox_text,
                "bbox_icon": bbox_icon if keep_icon else None
            }

        left_w = max(1, min(int(box_h / 2), box_w - 2))
        right_w = max(1, min(int(box_h / 2), box_w - left_w - 1))
        center_w = max(1, box_w - left_w - right_w)
        new_center_w = max(1, target_w - left_w - right_w)

        box_crop = image.crop((box_x, box_y, box_x + box_w, box_y + box_h))
        left_slice = box_crop.crop((0, 0, left_w, box_h))
        center_slice = box_crop.crop((left_w, 0, left_w + center_w, box_h))
        right_slice = box_crop.crop((box_w - right_w, 0, box_w, box_h))
        center_resized = center_slice.resize((new_center_w, box_h))

        new_box = Image.new(box_crop.mode, (target_w, box_h))
        new_box.paste(left_slice, (0, 0))
        new_box.paste(center_resized, (left_w, 0))
        new_box.paste(right_slice, (left_w + new_center_w, 0))

        new_image = image.copy()
        new_image.paste(new_box, (box_x, box_y))

        resized_path = temp_dir / f"step_resize_{field}.png"
        new_image.save(resized_path)

        if target_w < box_w:
            remove_x = box_x + target_w
            remove_w = box_w - target_w
            remove_bbox = (remove_x, box_y, remove_w, box_h)
            prompt = (
                "Remove any remaining box segment in this area and fill with the surrounding background seamlessly. "
                "Do NOT change colors, lighting, or add shadows."
            )
            cleaned_path = temp_dir / f"step_resize_{field}_clean.png"
            resized_path = self._edit_image_masked(resized_path, prompt, cleaned_path, remove_bbox, padding=2)

        new_bbox_full = (box_x, box_y, target_w, box_h)
        new_text_x = box_x + text_offset
        new_text_w = max(1, min(new_text_w, target_w - text_offset - padding_right))
        new_bbox_text = (new_text_x, text_y, new_text_w, text_h)

        new_bbox_icon = None
        if keep_icon and bbox_icon and icon_offset is not None:
            icon_x, icon_y, icon_w, icon_h = bbox_icon
            new_bbox_icon = (box_x + icon_offset, icon_y, icon_w, icon_h)

        return resized_path, {
            "bbox_full": new_bbox_full,
            "bbox_text": new_bbox_text,
            "bbox_icon": new_bbox_icon
        }

    def _edit_image_step(self, image_path: Path, prompt: str, output_path: Path) -> Path:
        """
        Executa uma etapa de edição na imagem usando a API do Gemini.
        """
        logger.info(f"Executando edição com prompt: {prompt}")
        
        try:
            image = Image.open(image_path)
            edited = self._call_image_model(image, prompt)
            edited.save(output_path)
            logger.info(f"Imagem gerada salva em {output_path}")
            return output_path

        except Exception as e:
            logger.error(f"Erro na API de Imagem: {e}")
            raise e

    def _edit_image_step_raw(self, image_path: Path, prompt: str, output_path: Path) -> Path:
        logger.info("Executando ajuste manual cru em 4K.")

        try:
            image = Image.open(image_path).convert("RGB")
            edited = self._call_image_model_raw_adjustment(image, prompt)
            edited.save(output_path)
            logger.info("Imagem crua do ajuste manual salva em %s", output_path)
            return output_path
        except Exception as e:
            logger.error("Erro na API de Imagem (ajuste manual cru): %s", e)
            raise e

    def _edit_image_step_with_reference(
        self,
        image_path: Path,
        prompt: str,
        output_path: Path,
        reference_image_path: Path,
        reference_hint: str,
        force_reference: bool = False,
    ) -> Path:
        if self.executor_single_image_mode and not force_reference:
            logger.info("Executor single-image mode ativo. Ignorando imagem de referência para evitar alucinação multimagem.")
            return self._edit_image_step(image_path, prompt, output_path)
        logger.info(f"Executando edição com referência de preservação: {reference_hint}")

        try:
            image = Image.open(image_path)
            reference_image = Image.open(reference_image_path)
            full_prompt = (
                f"{prompt}\n"
                "Use a imagem de referência APENAS como guia visual estrutural para o KV (Key Visual).\n"
                "Mantenha rigorosamente degradê, opacidade, contraste, overlays, formas orgânicas, textos, boxes e logotipo da imagem ATUAL.\n"
                "ATENÇÃO CRÍTICA: O texto da imagem de referência é antigo e DEVE SER IGNORADO. NÃO COPIE TEXTO DA REFERÊNCIA.\n"
                f"Aplique APENAS a alteração solicitada em {reference_hint}, usando a referência para manter a consistência visual do layout."
            )
            edited = self._call_image_model(image, full_prompt, reference_images=[reference_image])
            edited.save(output_path)
            logger.info(f"Imagem gerada com referência salva em {output_path}")
            return output_path

        except Exception as e:
            logger.error(f"Erro na API de Imagem com referência: {e}")
            raise e

    def _should_apply_persona_reference_stabilization(self, canal: str) -> bool:
        return bool(canal and canal.strip())

    # ── Refinamentos específicos por canal ─────────────────────────────────────
    # Instruções adicionais baseadas na análise visual de cada template.
    # Injetadas no prompt de Fase 1, ANTES das alterações de texto.
    # Foco principal: comportamento das boxes em cada geometria de canal.
    CHANNEL_REFINEMENTS: Dict[str, List[str]] = {

        # Quadrado 1:1. Texto centralizado em bloco na metade inferior.
        # Boxes empilhadas verticalmente, cada uma ocupando ~80% da largura do frame.
        # Risco: box esticada até as bordas laterais do frame.
        "01_feed_instagram": [
            "Layout quadrado (1:1): boxes centralizadas, empilhadas verticalmente na parte inferior.",
            "Boxes com largura proporcional ao texto —  nunca esticar as bordas além do necessário.",
            "Boxes sempre devem ficar em somente uma linha única.",
        ],

        # Vertical 9:16. Frame estreito. Texto centralizado no terço inferior.
        # Boxes empilhadas, cada uma ocupando quase toda a largura disponível da coluna de texto.
        # Risco: com frame estreito, a AI considera "proporcional" como "toda a largura da tela".
        "02_story_instagram": [
            "O layout é vertical (9:16), frame estreito. As boxes ficam empilhadas na parte inferior, centralizadas.",
            "Por ser frame estreito, a largura das boxes deve ser proporcional ao TEXTO — não à largura total da tela.",
            "NUNCA esticar a box horizontalmente até as bordas laterais. A box deve ser compacta e encaixar o texto com padding mínimo.",
            "Se o texto for curto, a box deve ser notavelmente menor que a largura total disponível.",
        ],

        # Horizontal wide (~3:1). Layout de 2 colunas: texto à esquerda, persona à direita.
        # Boxes ficam LADO A LADO na mesma linha horizontal, na coluna esquerda.
        # Risco: boxes empilhadas verticalmente (comportamento errado) ou esticadas até o centro do frame.
        "03_banner_interno_desktop": [
            "O layout é horizontal widescreen (~3:1), dividido em coluna esquerda (texto) e coluna direita (persona).",
            "A disposição das boxes deve ser ADAPTATIVA com base na largura útil da frase (linha acima das boxes): se box1 + box2 + gap ultrapassar essa largura, empilhe verticalmente; se couber, mantenha lado a lado.",
            "Cada box deve ser compacta: largura proporcional ao ícone + texto, sem ultrapassar o limite da coluna esquerda.",
            "NUNCA esticar as boxes até a coluna de persona (metade direita do frame).",
        ],

        # Vertical retrato estreito (~3:4 ou similar). Layout de 2 colunas comprimidas:
        # texto à esquerda (coluna estreita), persona à direita.
        # Boxes ficam LADO A LADO, mas o espaço horizontal é muito reduzido.
        # Risco: boxes esticadas toda a largura do frame, sobrepostas à persona.
        "04_banner_interno_mobile": [
            "O layout é vertical com proporção retrato, dividido em coluna esquerda estreita (texto) e coluna direita (persona).",
            "A disposição das boxes deve ser ADAPTATIVA com base na largura útil da frase (linha acima das boxes): se box1 + box2 + gap ultrapassar essa largura, empilhe verticalmente; se couber, mantenha lado a lado.",
            "O espaço horizontal é reduzido: cada box deve ser muito compacta, jamais ultrapassando a coluna de texto.",
            "NUNCA esticar as boxes até a coluna de persona. As boxes pertencem exclusivamente à metade esquerda.",
        ],

        # Quadrado 1:1. Texto centralizado em bloco na metade inferior (semelhante ao feed).
        # Boxes empilhadas verticalmente, mas com espaçamento entre elas.
        # Risco menor que outros canais (já corrigido). Manutenção do comportamento atual.
        "05_whatsapp": [
            "Layout quadrado (1:1): boxes centralizadas, empilhadas verticalmente na parte inferior.",
            "Boxes com largura proporcional ao texto — nunca esticar as bordas além do necessário.",
            "Boxes sempre devem ficar em somente uma linha única.",
            "Preserve o degradê do template original, sem alterar a cor ou a transparência.",
        ],

        # Horizontal wide, SEM texto editável. Apenas persona.
        # Refinamento mínimo — só reforça que não deve ter caixas de texto neste canal.
        "06_banner_home_desktop": [
            "Este template não contém boxes de texto editáveis. NÃO adicionar boxes, etiquetas ou textos que não existiam no template.",
            "A única alteração permitida é na persona/background.",
        ],

        # Mesmo princípio do banner home desktop, versão mobile.
        "07_banner_home_mobile": [
            "Este template não contém boxes de texto editáveis. NÃO adicionar boxes, etiquetas ou textos que não existiam no template.",
            "A única alteração permitida é na persona/background.",
        ],

        # Horizontal (~2:1 ou 3:2). Layout de 2 colunas: texto à esquerda (coluna estreita), persona à direita.
        # Boxes ficam EMPILHADAS VERTICALMENTE dentro da coluna esquerda estreita.
        # MAIOR risco: boxes esticam full-width da coluna esquerda (comportamento observado na geração problemática).
        "08_topo_email": [
            "Layout horizontal: boxes ficam na COLUNA ESQUERDA, empilhadas verticalmente. Não ocupam o frame inteiro.",
            "Boxes com largura proporcional ao texto — não esticar até o limite da coluna.",
        ],
    }

    def _get_channel_refinements(self, canal: str) -> List[str]:
        """Retorna instruções específicas do canal para injetar no prompt da Fase 1."""
        return self.CHANNEL_REFINEMENTS.get(canal, [])

    def _build_general_text_layer(self) -> List[str]:
        return [
            "Realize apenas as alterações pedidas, preservando fonte, cores, degradê, logo e composição original.",
            "Logotipos ENS + 'A sua Escola de Negócios e Seguros' e, quando existir, AIDA Brasil devem permanecer INALTERADOS e legíveis.",
            "É proibido distorcer, borrar, redesenhar, suavizar ou perder nitidez em qualquer logotipo.",
            "Preserve espaçamentos e distâncias entre etiqueta, título, frase, boxes e logo sem colapsar elementos.",
            "Existem duas boxes e as duas devem permanecer visíveis ao final.",
            "NUNCA remover, ocultar, fundir ou descartar box1 ou box2.",
            "Cada box deve conter exatamente 1 ícone, posicionado à esquerda do texto.",
            "O ícone deve ficar dentro da box, antes do texto, com padding interno visível.",
            "É proibido criar ícone solto, standalone ou ícone externo à box; não colocar ícone acima, abaixo ou à esquerda fora do retângulo da box.",
            "Nunca remover, suavizar ou reduzir o degradê original do template.",
        ]

    def _build_text_composition_layer(self) -> List[str]:
        return [
            "DIREÇÃO DE ARTE TEXTUAL: harmonizar etiqueta, título, frase, box1 e box2 como um bloco editorial, preservando o estilo do template.",
            "Título pode quebrar em até 2 linhas equilibradas quando o texto ficar comprido para a largura útil; evitar título longo espremido em uma linha.",
            "Use ajuste leve de escala, entrelinha e espaçamento vertical em etiqueta/título/frase apenas quando necessário para manter hierarquia e leitura, sem trocar fonte, peso, cor ou alinhamento-base.",
            "Frase pode ocupar 1 ou 2 linhas, com quebra natural e largura visual equilibrada abaixo do título.",
            "Textos curtos não devem ficar pequenos demais ou perdidos; preservar presença visual condizente com o template.",
        ]

    def _build_box_refiner_layer(self) -> List[str]:
        return [
            "CRÍTICO — FONTE FIXA: manter exatamente o tamanho de fonte original das boxes.",
            "CRÍTICO — ALTURA FIXA: manter exatamente a altura original das boxes.",
            "CRÍTICO — LARGURA INDEPENDENTE: cada box calcula a própria largura de forma independente.",
            "Se uma box tiver texto menor que a outra, a box menor deve permanecer menor. Nunca igualar larguras automaticamente.",
            "A largura final de cada box deve ser a menor possível para conter ícone + texto sem corte.",
            "Se o ícone não couber dentro da box com padding interno visível, redimensionar a box o mínimo necessário; nunca expulsar o ícone para fora da box.",
            "É proibido esticar a box inteira como barra longa para preencher espaço vazio.",
            "Não alterar espessura de borda, raio dos cantos, padding interno e posição global do bloco de boxes.",
            "Prioridade máxima é preservar ambas as boxes e sua legibilidade.",
        ]

    def _build_channel_layer(self, canal: str) -> List[str]:
        refinements = self._get_channel_refinements(canal)
        if refinements:
            return refinements
        return [f"Canal ativo: {canal}. Respeite a geometria e a hierarquia visual originais do template."]

    def _generate_text_change_prompt(self, request: BannerRequest, context: Dict[str, Any]) -> str:
        keys = request.content_keys
        meta = request.request_meta
        template_guidance = self._build_template_kv_guidance(context, meta)
        template_path = self._resolve_template_path_for_meta(meta)
        step_payload = self._load_template_step_payload(template_path, "step1_text")
        color_lock_policy = self._resolve_color_lock_policy(template_path, step_payload=step_payload)
        lines = []
        lines.append("Camada 1 — regras gerais:")
        for rule in self._build_general_text_layer():
            lines.append(rule)
        for rule in self._build_text_composition_layer():
            lines.append(rule)
        for rule in self._build_color_lock_instruction_lines(color_lock_policy):
            lines.append(rule)
        for rule in self._build_box_refiner_layer():
            lines.append(rule)
        lines.append("Camada 2 — refinamentos do canal:")
        for refinement in self._build_channel_layer(meta.canal):
            lines.append(refinement)
        lines.append("Camada 3 — contexto do template (KV):")
        lines.append(template_guidance)
        
        text_fields = ["etiqueta", "titulo", "frase"]
        for field in text_fields:
            new_value = getattr(keys, field)
            context_item = context.get(field)
            if context_item and new_value:
                current_value = context_item.get("texto_atual", "")
                if current_value and new_value != current_value:
                    lines.append(f'- mude a {field} de "{current_value}" para "{new_value}"')

        box_fields = ["box1", "box2"]
        for field in box_fields:
            new_value = getattr(keys, field)
            context_item = context.get(field)
            if context_item and new_value:
                current_value = context_item.get("texto_atual", "")
                if current_value and new_value != current_value:
                    icon_instruction = self._refine_box_icon_prompt(new_value, field)
                    lines.append(f'- mude a {field} de "{current_value}" para "{new_value}" e {icon_instruction}')

        return "\n".join(lines)

    def _generate_main_text_prompt(self, request: BannerRequest, context: Dict[str, Any]) -> str:
        keys = request.content_keys
        lines = []
        lines.append("Realize apenas as alterações de etiqueta, título e frase.")
        lines.append("Não alterar boxes, ícones, logotipo, rodapé, persona e degradê do KV.")
        lines.append("Mantenha fonte, peso, espaçamento e alinhamentos originais.")
        for field in ["etiqueta", "titulo", "frase"]:
            new_value = getattr(keys, field)
            context_item = context.get(field)
            if context_item and new_value:
                current_value = context_item.get("texto_atual", "")
                if current_value and new_value != current_value:
                    lines.append(f'- mude a {field} de "{current_value}" para "{new_value}"')
        return "\n".join(lines)

    def _generate_boxes_prompt(self, request: BannerRequest, context: Dict[str, Any]) -> str:
        keys = request.content_keys
        meta = request.request_meta
        template_guidance = self._build_template_kv_guidance(context, meta)
        template_path = self._resolve_template_path_for_meta(meta)
        step_payload = self._load_template_step_payload(template_path, "step1_text")
        color_lock_policy = self._resolve_color_lock_policy(template_path, step_payload=step_payload)
        lines = []
        lines.append("Camada 1 — regras gerais:")
        lines.append("Realize apenas as alterações de box1 e box2.")
        lines.append("NUNCA alterar etiqueta, título, frase, logotipo, rodapé e persona.")
        for rule in self._build_general_text_layer():
            lines.append(rule)
        for rule in self._build_color_lock_instruction_lines(color_lock_policy):
            lines.append(rule)
        for rule in self._build_box_refiner_layer():
            lines.append(rule)
        lines.append("Camada 2 — refinamentos do canal:")
        for refinement in self._build_channel_layer(meta.canal):
            lines.append(refinement)
        lines.append("Camada 3 — contexto do template (KV):")
        lines.append(template_guidance)
        for field in ["box1", "box2"]:
            new_value = getattr(keys, field)
            context_item = context.get(field)
            if context_item and new_value:
                current_value = context_item.get("texto_atual", "")
                if current_value and new_value != current_value:
                    icon_instruction = self._refine_box_icon_prompt(new_value, field)
                    lines.append(f'- mude a {field} de "{current_value}" para "{new_value}" e {icon_instruction}')
        return "\n".join(lines)

    def _has_prompt_edits(self, prompt: str) -> bool:
        return "- mude a " in prompt

    def _collect_locked_fields(self, context: Dict[str, Any], keys: Optional[ContentKeys] = None) -> List[Tuple[str, str]]:
        locked_fields: List[Tuple[str, str]] = []
        for field in ("etiqueta", "titulo", "frase", "box1", "box2"):
            request_value = getattr(keys, field, None) if keys else None
            if isinstance(request_value, str) and request_value.strip():
                locked_fields.append((field, request_value.strip()))
                continue
            if isinstance(context, dict):
                item = context.get(field)
                if isinstance(item, dict):
                    current = item.get("texto_atual")
                    if isinstance(current, str) and current.strip():
                        locked_fields.append((field, current.strip()))
        return locked_fields

    def _build_expected_texts_json(self, context: Dict[str, Any], keys: Optional[ContentKeys] = None) -> str:
        expected_texts = {field: value for field, value in self._collect_locked_fields(context, keys)}
        return json.dumps(expected_texts, ensure_ascii=False)

    def _build_step3_text_lock_guardrails(self, context: Dict[str, Any], keys: Optional[ContentKeys] = None) -> str:
        expected_texts_json = self._build_expected_texts_json(context, keys)
        if expected_texts_json == "{}":
            return ""
        return (
            f"EXPECTED_TEXTS: {expected_texts_json}\n"
            "EXPECTED_TEXTS é a fonte da verdade textual para etiqueta, título, frase, box1 e box2.\n"
            "Texto do CONTEXTO_JSON/template é referência visual de estilo, geometria e hierarquia, nunca conteúdo textual a copiar.\n"
            "Reprovar se qualquer texto da imagem gerada estiver diferente, truncado, ausente ou revertido para texto do template base.\n"
            "No prompt_correcao, preservar exatamente os textos de EXPECTED_TEXTS; não substituir por textos do template.\n"
        )

    def _append_step3_correction_guardrails(
        self,
        correction_prompt: str,
        context: Dict[str, Any],
        keys: Optional[ContentKeys] = None
    ) -> str:
        text_lock_guardrails = self._build_step3_text_lock_guardrails(context, keys)
        adaptive_box_guardrails = (
            "ADAPTAÇÃO MÍNIMA PERMITIDA DAS BOXES: pode adaptar largura, empilhamento e espaçamento local das boxes "
            "para acomodar textos maiores com harmonia e legibilidade. Manter cada texto em linha única quando possível; "
            "se box1 + box2 não couberem com respiro adequado, empilhar verticalmente. Não alterar KV, degradê, logotipo, "
            "grafismos ou persona. Não repintar persona/fundo; sem saturação extra, HDR, blur, skin smoothing ou mudança "
            "de iluminação humana."
        )
        text_composition_guardrails = (
            "ADAPTAÇÃO MÍNIMA PERMITIDA DO BLOCO TEXTUAL: pode rediagramar etiqueta, título, frase e boxes para melhorar "
            "harmonia macro, incluindo quebrar título longo em até 2 linhas equilibradas e aplicar ajuste leve de escala, "
            "entrelinha e espaçamento em etiqueta/título/frase. Preservar exatamente EXPECTED_TEXTS, fonte, peso, cores, "
            "tamanho de fonte das boxes, KV, logotipo, grafismos e persona."
        )
        parts = [correction_prompt.strip(), text_lock_guardrails.strip(), adaptive_box_guardrails, text_composition_guardrails]
        return "\n".join(part for part in parts if part)

    def _build_persona_text_lock(self, context: Dict[str, Any], keys: Optional[ContentKeys] = None) -> str:
        locked_fields = self._collect_locked_fields(context, keys)
        if not locked_fields:
            return ""
        lines = ["Manter exatamente estes textos sem qualquer alteração:"]
        for field, value in locked_fields:
            lines.append(f'- {field}: "{value}"')
        return "\n".join(lines)

    def _generate_persona_change_prompt(
        self,
        request: BannerRequest,
        context: Dict[str, Any],
        layout_image_path: Optional[Path] = None,
        use_refiner: bool = True
    ) -> str:
        """
        Gera o prompt em português para a Fase 2 (Alteração de Persona).
        """
        meta = request.request_meta
        keys = request.content_keys
        if not keys.persona:
            return ""

        template_guidance = self._build_template_kv_guidance(context, meta)
        text_lock = self._build_persona_text_lock(context, keys)
        template_path = self._resolve_template_path_for_meta(meta)
        step_payload = self._load_template_step_payload(template_path, "step2_persona")
        color_lock_policy = self._resolve_color_lock_policy(template_path, step_payload=step_payload)
        color_lock_rules = self._build_color_lock_instruction_lines(color_lock_policy)
        color_lock_block = ""
        if color_lock_rules:
            color_lock_block = "15) Regras globais de cor (obrigatórias): " + " | ".join(color_lock_rules) + ".\n"
        is_human = self._is_human_persona_request(keys.persona)
        requested_human_count = self._extract_requested_human_count(keys.persona)
        if is_human:
            refined_desc = self._refine_persona_prompt(keys.persona, layout_image_path) if use_refiner else keys.persona
            header = "Tarefa: alterar APENAS a persona/foto de fundo mantendo o KV 100% intacto."
            subject_line = f"Nova persona: '{refined_desc}'."
            human_count_line = ""
            if requested_human_count is not None:
                human_count_line = (
                    f"10) É obrigatório renderizar {requested_human_count} pessoa(s) humana(s) visível(is), "
                    "sem substituir por ambiente vazio.\n"
                )
            extra_rules = (
                "8) Prompt negativo obrigatório para evitar artefatos: "
                f"{self._build_persona_negative_prompt()}.\n"
                "9) Faça validação interna de coerência anatômica antes de gerar: mãos naturais, pele com microtextura e olhos realistas.\n"
                f"{human_count_line}"
            )
        else:
            refined_desc = self._refine_background_prompt(keys.persona, layout_image_path) if use_refiner else keys.persona
            header = "Tarefa: alterar APENAS o fundo da imagem (SEM PESSOAS) mantendo o KV 100% intacto."
            subject_line = f"Novo fundo sem pessoas: '{refined_desc}'."
            extra_rules = "8) NÃO adicionar pessoas, rostos, mãos, silhuetas ou personagens no fundo.\n"

        return (
            f"{header}\n"
            f"{subject_line}\n"
            "Camada 1 — regras gerais:\n"
            "NÃO REGERAR o banner completo.\n"
            "Use modo de edição localizada, alterando somente a persona/fundo solicitado.\n"
            "O bloco de textos e boxes deve permanecer pixel-equivalente ao estado atual.\n"
            "1) NÃO mover, reduzir, aumentar ou reposicionar o degradê/overlay do KV.\n"
            "2) NUNCA reduzir a opacidade do degradê do KV; manter a mesma densidade visual do template.\n"
            "3) PROIBIDO gerar fundo transparente, lavado ou desbotado na área do KV.\n"
            "3.1) A imagem final deve ser totalmente opaca (sem alpha), sem vazamento de pixels da foto antiga.\n"
            "3.2) A nova persona/fundo deve existir como última camada de fundo, por trás de todos os elementos do KV.\n"
            "3.3) NÃO repintar, recriar, suavizar ou reduzir a opacidade do degradê/overlay frontal.\n"
            "3.4) É proibido colocar a nova persona acima de texto, boxes, ícones, logo, overlays ou formas orgânicas.\n"
            "4) NÃO alterar as formas orgânicas do KV (posição, tamanho, opacidade, cor).\n"
            "5) NÃO alterar textos, boxes, ícones, logotipo e tipografia.\n"
            "6) Mantenha a fonte Outfit nas boxs 1 e 2, com o mesmo peso e espessura atuais.\n"
            "7) NÃO alterar cores gerais, contraste ou saturação do KV.\n"
            "8) A persona deve ser fotorrealista, com textura de pele natural e detalhes humanos reais.\n"
            "9) Evitar aparência de pele plástica, rosto emborrachado, CGI ou arte digital.\n"
            "10) Não herdar acessórios ou objetos do template base na nova persona, exceto quando forem explicitamente pedidos no texto do usuário.\n"
            "11) A persona deve ficar encaixada no mesmo espaço visual da foto original do template, sem deslocar para fora da área de persona.\n"
            "12) Preserve os limites naturais da área da persona e mantenha o restante do KV sólido com o degradê/sombra original.\n"
            "12.1) Substitua a área completa da foto da persona sem manter resíduos, silhuetas ou traços da persona anterior.\n"
            "13) Se o pedido não citar tablet, não inserir tablet na mão, sobre mesa ou em primeiro plano.\n"
            "14) Se o pedido não citar notebook, não inserir notebook em destaque junto da persona.\n"
            f"{color_lock_block}"
            "Camada 2 — refinamentos do canal:\n"
            f"Canal ativo: {meta.canal}. Preserve enquadramento e geometria desse formato sem deslocar o bloco textual.\n"
            "Camada 3 — contexto do template (KV):\n"
            f"{template_guidance}\n"
            f"{text_lock}\n"
            f"{extra_rules}"
            "Confirme preservação total do KV e aplique apenas a alteração de fundo."
        )

    def _run_step3_correction_cycle(
        self,
        current_image_path: Path,
        temp_dir: Path,
        kv_structure_reference_path: Path,
        context: Dict[str, Any],
        meta: RequestMeta,
        keys: Optional[ContentKeys] = None
    ) -> Path:
        step3_validation = self._validate_step3_output(kv_structure_reference_path, current_image_path, context, meta, keys)
        if step3_validation.status == "APROVADO":
            logger.info("Step 3 aprovado sem necessidade de correção.")
            return current_image_path

        if step3_validation.status != "CORREÇÃO":
            raise RuntimeError(f"Status inválido no Step 3: {step3_validation.status}")

        correction_round = 0
        while correction_round < self.max_step3_correction_rounds:
            correction_prompt = (step3_validation.prompt_correcao or "").strip()
            if self.enable_step3_planner:
                planner_step3 = self._run_planner_step(
                    step_name="step3_validation",
                    user_request=correction_prompt or (step3_validation.motivo or "Ajustar critérios reprovados do validador."),
                    context=context,
                    meta=meta,
                    reference_images=[kv_structure_reference_path, current_image_path],
                    fallback_prompt=correction_prompt,
                )
                correction_prompt = (planner_step3.get("correction_prompt_final") or planner_step3.get("edit_prompt_final") or correction_prompt).strip()
            if not correction_prompt:
                motivo = step3_validation.motivo or "validator sem motivo"
                raise RuntimeError(
                    f"Step 3 retornou CORREÇÃO sem prompt_correcao na rodada {correction_round + 1}: {motivo}"
                )
            correction_prompt = self._append_step3_correction_guardrails(correction_prompt, context, keys)

            correction_round += 1
            file_suffix = "" if correction_round == 1 else f"_{correction_round}"
            step3_correction_path = temp_dir / f"step3_validation_unified{file_suffix}.png"
            logger.info("Aplicando correção Step 3.%s", correction_round)
            step3_base_path = current_image_path
            current_image_path = self._edit_image_step_with_reference(
                step3_base_path,
                correction_prompt,
                step3_correction_path,
                kv_structure_reference_path,
                "degradê, logotipo, boxes e grafismos orgânicos dos cantos do KV"
            )
            if self._is_global_overcorrection(step3_base_path, current_image_path):
                logger.warning(
                    "Correção Step 3.%s descartada por alteração global excessiva (potencial regressão para template/versão anterior).",
                    correction_round
                )
                return step3_base_path
            if self._is_persona_region_degraded(step3_base_path, current_image_path):
                logger.warning(
                    "Correção Step 3.%s descartada por alterar significativamente a região de persona/fundo.",
                    correction_round
                )
                return step3_base_path

            text_lock_validation = self._validate_text_lock_output(current_image_path, context, meta, keys)
            if text_lock_validation.status != "APROVADO":
                logger.warning(
                    "Correção Step 3.%s descartada por violar Text Lock: %s",
                    correction_round,
                    text_lock_validation.motivo
                )
                return step3_base_path

            if self.enable_step3_persona_lock_validation:
                persona_lock_validation = self._validate_step3_persona_lock_output(step3_base_path, current_image_path, meta)
                if persona_lock_validation.status != "APROVADO":
                    logger.warning(
                        "Correção Step 3.%s descartada por violar Persona Lock: %s",
                        correction_round,
                        persona_lock_validation.motivo
                    )
                    return step3_base_path

            post_step3_validation = self._validate_step3_output(kv_structure_reference_path, current_image_path, context, meta, keys)
            if post_step3_validation.status == "APROVADO":
                logger.info("Step 3.%s aprovado.", correction_round)
                return current_image_path

            step3_validation = post_step3_validation
            logger.warning(
                "Validação unificada ainda indicou correção após Step 3.%s: %s",
                correction_round,
                step3_validation.motivo
            )

        logger.warning(
            "Step 3 atingiu o limite de %s correções. Seguindo com a última imagem gerada para o resize final.",
            self.max_step3_correction_rounds
        )
        return current_image_path

    def process_job(self, request: BannerRequest) -> Path:
        """Executa pipeline principal com planners opcionais por etapa."""
        meta = request.request_meta
        keys = request.content_keys
        
        # 1. Seleção do Template
        template_path = select_template(meta.canal, meta.kv)
        logger.info(f"Template selecionado: {template_path}")
        
        # 2. Carregar Contexto
        context = self.load_template_context(template_path)
        self._ensure_template_planner_payloads(template_path, meta, context)
        
        # 3. Inicializar Estado
        # Para este modo simplificado, usamos o 'Template (final).png' como base
        # Se ele não existir, usamos o template_path (que é o PNG base)
        final_template_path = template_path.parent / "Template (final).png"
        if not final_template_path.exists():
            final_template_path = template_path
            
        current_image_path = final_template_path
        kv_structure_reference_path = current_image_path
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        # Diretório temporário
        temp_dir = Path("temp") / f"{meta.canal}_{meta.kv}_{timestamp}"
        temp_dir.mkdir(parents=True, exist_ok=True)
        
        # --- FASE 1: TEXTOS ---
        text_prompt = self._generate_text_change_prompt(request, context)
        should_run_step1 = self._has_prompt_edits(text_prompt)
        if self.enable_step1_planner and should_run_step1:
            planner_step1 = self._run_planner_step(
                step_name="step1_text",
                user_request=text_prompt,
                context=context,
                meta=meta,
                reference_images=[current_image_path],
                fallback_prompt=text_prompt,
                template_path=template_path,
            )
            text_prompt = planner_step1.get("edit_prompt_final", text_prompt)
        if should_run_step1:
            logger.info("--- FASE 1: Alteração de Textos ---")
            logger.info(f"Prompt Fase 1:\n{text_prompt}")
            step1_path = temp_dir / "step1_texts.png"
            current_image_path = self._edit_image_step_with_reference(
                current_image_path,
                text_prompt,
                step1_path,
                current_image_path,
                "logotipos, rodapé e estrutura visual geral do KV"
            )
        else:
            logger.info("Sem alterações de texto detectadas. Pulando Fase 1.")

        # Âncora de estrutura após Step 1: evita usar template base como referência nos próximos steps.
        kv_structure_reference_path = current_image_path
        
        # --- FASE 2: PERSONA ---
        # Verificar se persona mudou
        persona_context = context.get("persona") if isinstance(context, dict) else None
        original_persona = ""
        if isinstance(persona_context, dict):
            original_persona = (persona_context.get("descricao") or "").strip()
        
        if keys.persona and keys.persona.strip() != original_persona:
            use_persona_refiner = not self.enable_step2_planner
            persona_prompt = self._generate_persona_change_prompt(
                request,
                context,
                current_image_path,
                use_refiner=use_persona_refiner
            )
            if self.enable_step2_planner:
                planner_step2 = self._run_planner_step(
                    step_name="step2_persona",
                    user_request=persona_prompt,
                    context=context,
                    meta=meta,
                    reference_images=[current_image_path],
                    fallback_prompt=persona_prompt,
                    template_path=template_path,
                )
                persona_prompt = planner_step2.get("edit_prompt_final", persona_prompt)
            logger.info("--- FASE 2: Alteração de Persona (direto no template) ---")
            logger.info(f"Prompt Fase 2:\n{persona_prompt}")
            step2_path = temp_dir / "step2_persona.png"
            current_image_path = self._edit_image_step_with_reference(
                current_image_path,
                persona_prompt,
                step2_path,
                kv_structure_reference_path,
                "estrutura do KV e área completa da foto da persona (sem resíduos da persona anterior)",
                force_reference=True,
            )
        else:
            logger.info("Persona não alterada ou igual ao original. Pulando Fase 2.")

        editable_source_path = current_image_path
        logger.info("--- FASE 3: Pós-processamento de Resolução Final ---")
        target_size = self._read_dimensions_from_file(final_template_path)
        step4_path = temp_dir / "step4_delivery_size.png"
        current_image_path = self._postprocess_final_resolution(current_image_path, target_size, step4_path)

        # Finalização
        outputs_dir = Path("outputs")
        outputs_dir.mkdir(exist_ok=True)
        final_filename = f"{meta.canal}_{meta.kv}_{timestamp}.png"
        final_path = outputs_dir / final_filename
        
        # Copiar resultado final
        with open(current_image_path, "rb") as src, open(final_path, "wb") as dst:
            dst.write(src.read())

        self._persist_editable_output(editable_source_path, final_path)
            
        logger.info(f"Job concluído. Resultado: {final_path}")
        return final_path

    def process_adjustment(
        self,
        image_path: Path,
        prompt: str,
        target_size: Optional[Tuple[int, int]] = None,
    ) -> Path:
        """
        Executa um ajuste manual iterativo solicitado pelo usuário.
        """
        logger.info(f"--- FASE: Ajuste Manual ---")
        logger.info(f"Imagem base: {image_path}")
        logger.info(f"Prompt de ajuste: {prompt}")

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        temp_dir = Path("temp") / f"adjustment_{timestamp}"
        temp_dir.mkdir(parents=True, exist_ok=True)
        
        manual_prompt = prompt.strip()
        if not manual_prompt:
            raise ValueError("Prompt de ajuste manual não pode estar vazio.")

        adjusted_path = temp_dir / "adjusted_raw.png"
        current_image_path = self._edit_image_step_raw(image_path, manual_prompt, adjusted_path)

        editable_source_path = current_image_path
        logger.info("--- FASE: Pós-processamento de Resolução Final (Ajuste) ---")
        if target_size is None:
            try:
                target_size = self._resolve_adjustment_target_size(image_path)
            except Exception:
                target_size = (1080, 1080)

        step_final_path = temp_dir / "adjusted_resized.png"
        current_image_path = self._postprocess_final_resolution(current_image_path, target_size, step_final_path)

        outputs_dir = Path("outputs")
        outputs_dir.mkdir(exist_ok=True)
        delivery_base_image_path = delivery_output_path_from_editable(image_path) or image_path
        final_filename = f"adj_{timestamp}_{delivery_base_image_path.name}"
        final_path = outputs_dir / final_filename
        
        with open(current_image_path, "rb") as src, open(final_path, "wb") as dst:
            dst.write(src.read())

        self._persist_editable_output(editable_source_path, final_path)
            
        logger.info(f"Ajuste concluído. Resultado: {final_path}")
        return final_path

# ---------------------------------------------------------------------------
# Função Wrapper para Compatibilidade com API existente
# ---------------------------------------------------------------------------

def generate_banner(request: BannerRequest) -> Path:
    orchestrator = NexusImageOrchestrator()
    return orchestrator.process_job(request)

# ---------------------------------------------------------------------------
# CLI Entry Point
# ---------------------------------------------------------------------------

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="ENS AI Banner Factory — Orquestrador Nexus Designer",
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--input", "-i", type=Path, help="Arquivo JSON de input.")
    group.add_argument("--json", "-j", type=str, help="String JSON inline.")
    return parser.parse_args()

if __name__ == "__main__":
    args = parse_args()
    
    try:
        if args.input:
            with open(args.input, "r", encoding="utf-8") as f:
                data = json.load(f)
        elif args.json:
            data = json.loads(args.json)
        else:
            # Tentar ler do stdin
            if not sys.stdin.isatty():
                data = json.load(sys.stdin)
            else:
                parser.print_help()
                sys.exit(1)
        
        # Validar e Executar
        req = BannerRequest(**data)
        final_path = generate_banner(req)
        print(str(final_path)) # Output para stdout (usado por outros scripts)
        
    except Exception as e:
        logger.error(f"Erro fatal: {e}")
        sys.exit(1)
