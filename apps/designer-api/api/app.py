"""
api/app.py — FastAPI REST API para o Nexus Designer
===========================================================
Endpoints:
  POST /banners        → Submete um job de geração. Retorna job_id.
  GET  /banners/{id}   → Consulta status e URL do resultado.
  GET  /health         → Health check.

O pipeline é executado em background (asyncio + ThreadPoolExecutor).
"""

import asyncio
import json
import logging
import os
import shutil
import uuid
from enum import Enum
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, ConfigDict, ValidationError, field_validator

# Importar o core do projeto (main.py está na raiz)
import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from execution.select_template import TemplateNotFoundError, list_templates, select_template
from main import BannerRequest, ContentKeys, RequestMeta, GLOBAL_KVS_SEM_TITULO, generate_banner
from api.job_service import (
    ENXOVAL_CHANNELS,
    JobStatus,
    count_jobs,
    create_job,
    get_enxoval_metrics_summary,
    get_job,
    refresh_job_item_signed_url,
    submit_job,
    submit_adjustment,
    resume_interrupted_jobs,
)

load_dotenv()

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("nexus.api")

# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------
app = FastAPI(
    title="Nexus Designer API",
    description=(
        "API para geração automatizada de banners via Gemini 3 Pro (Nano Banana Pro). "
        "Suporta upload de imagens de persona e edição contextual."
    ),
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Servir arquivos de output via /files/
OUTPUTS_DIR = Path(os.getenv("OUTPUTS_DIR", "outputs"))
OUTPUTS_DIR.mkdir(exist_ok=True)
app.mount("/files", StaticFiles(directory=str(OUTPUTS_DIR)), name="files")

# Diretório para uploads temporários
UPLOADS_DIR = Path("temp/uploads")
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

# ---------------------------------------------------------------------------
# Schemas de Output (Input agora é via Form Data)
# ---------------------------------------------------------------------------

class JobCreatedResponse(BaseModel):
    job_id:      str
    status:      JobStatus
    status_url:  str
    created_at:  str

class JobStatusResponse(BaseModel):
    job_id:     str
    status:     JobStatus
    created_at: str
    updated_at: str
    modo_geracao: str
    progress: str
    itens: list[dict]
    metrics: dict
    file_url:   Optional[str] = None
    requested_by: Optional[str] = None
    error:      Optional[str] = None


class RefreshSignedUrlResponse(BaseModel):
    job_id: str
    item_id: str
    file_url: str
    signed_url_expires_at: Optional[str] = None

class TemplatesResponse(BaseModel):
    templates: dict[str, dict[str, list[str]]]
    total_canals: int
    total_kvs: int
    total_templates: int

class FormOptionsResponse(BaseModel):
    modos_geracao: list[str]
    canais_enxoval: list[str]
    canais_disponiveis: list[str]
    kvs_disponiveis: list[str]
    templates: dict[str, dict[str, list[str]]]


class EnxovalMetricsResponse(BaseModel):
    avg_seconds_per_channel: float
    avg_seconds_per_enxoval: float
    p95_seconds_per_enxoval: float
    sample_size: int
    last_updated_at: Optional[str] = None

class GenerationMode(str, Enum):
    PECA_UNICA = "peca_unica"
    ENXOVAL = "enxoval"

class FrontendBannerRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    modo_geracao: GenerationMode = GenerationMode.PECA_UNICA
    canal: Optional[str] = None
    kv: str
    etiqueta: str
    titulo: str = ""  # Opcional para KVs sem título (ex: tudo-sobre-seguros)
    frase: str
    box1: str
    box2: str = ""
    persona: str

    @field_validator("canal", "kv", "etiqueta", "titulo", "frase", "box1", "box2", "persona", mode="before")
    @classmethod
    def normalize_text_fields(cls, value):
        if value is None:
            return ""
        return str(value).strip()

def _resolve_target_channels(modo_geracao: GenerationMode, canal: Optional[str]) -> list[str]:
    if modo_geracao == GenerationMode.ENXOVAL:
        return list(ENXOVAL_CHANNELS)
    canal_value = (canal or "").strip()
    if not canal_value:
        raise HTTPException(status_code=422, detail="Campo 'canal' é obrigatório em modo peca_unica.")
    return [canal_value]

def _validate_job_id(job_id: str) -> str:
    try:
        uuid.UUID(job_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="job_id inválido.")
    return job_id

def _resolve_persona_value(persona: Optional[str], persona_desc: Optional[str]) -> str:
    direct_value = (persona or "").strip()
    if direct_value:
        return direct_value
    legacy_value = (persona_desc or "").strip()
    if legacy_value:
        return legacy_value
    raise HTTPException(status_code=422, detail="Campo 'persona' é obrigatório.")

def _templates_catalog() -> tuple[dict[str, dict[str, list[str]]], list[str], list[str]]:
    templates = list_templates()
    canais = sorted(templates.keys())
    kvs = sorted({kv for kv_map in templates.values() for kv in kv_map.keys()})
    return templates, canais, kvs

async def _create_and_submit_job(
    modo_geracao: GenerationMode,
    canal: Optional[str],
    kv: str,
    etiqueta: str,
    titulo: str,
    frase: str,
    box1: str,
    box2: str,
    persona: str,
    persona_image_path: Optional[str],
    requested_by: Optional[str],
) -> JobCreatedResponse:
    try:
        target_channels = _resolve_target_channels(modo_geracao, canal)
        request_meta = RequestMeta(canal=target_channels[0], kv=kv)
        content_keys = ContentKeys(
            etiqueta=etiqueta,
            titulo=titulo,
            frase=frase,
            box1=box1,
            box2=box2,
            persona=persona,
            persona_image_path=persona_image_path,
        )
        banner_request = BannerRequest(request_meta=request_meta, content_keys=content_keys)
        for target_canal in target_channels:
            select_template(target_canal, kv)
    except ValidationError as e:
        raise HTTPException(status_code=422, detail=e.errors())
    except TemplateNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Erro inesperado na validação: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))

    raw_request = banner_request.model_dump()
    if requested_by:
        raw_request.setdefault("request_meta", {})
        raw_request["request_meta"]["requested_by"] = requested_by
    job = create_job(modo_geracao.value, raw_request)
    loop = asyncio.get_running_loop()
    submit_job(loop, job.job_id, raw_request)
    logger.info(f"[job:{job.job_id}] Criado e enfileirado.")
    return JobCreatedResponse(
        job_id=job.job_id,
        status=job.status,
        status_url=f"/banners/{job.job_id}",
        created_at=job.created_at,
    )

@app.on_event("startup")
async def on_startup():
    loop = asyncio.get_running_loop()
    # Recupera jobs que ficaram presos como running/pending após um reinício e os falha graciosamente
    resume_interrupted_jobs(loop)

# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/health", tags=["Infra"])
def health_check():
    """Health check."""
    return {"status": "ok", "jobs_in_memory": count_jobs()}

class AdjustmentRequest(BaseModel):
    prompt: str

    @field_validator("prompt")
    @classmethod
    def validate_prompt(cls, value: str) -> str:
        cleaned = (value or "").strip()
        if not cleaned:
            raise ValueError("Prompt de ajuste é obrigatório.")
        return cleaned


@app.post(
    "/banners/{job_id}/items/{item_id}/adjust",
    status_code=202,
    tags=["Banners"],
    summary="Submeter ajuste em um item gerado",
)
async def adjust_banner_item(
    job_id: str,
    item_id: str,
    request: Request,
    x_user_id: Optional[str] = Header(None, alias="x-user-id"),
):
    _validate_job_id(job_id)
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' não encontrado.")
    
    # Valida se requested_by bate
    if job.requested_by and x_user_id and job.requested_by != x_user_id:
        raise HTTPException(status_code=403, detail="Sem permissão para alterar este job.")
        
    item = next((i for i in job.itens if i.item_id == item_id), None)
    if not item:
        raise HTTPException(status_code=404, detail=f"Item '{item_id}' não encontrado.")
    if item.status != "done" or not item.file_url:
        raise HTTPException(
            status_code=409,
            detail="Ajuste só pode ser solicitado para item concluído.",
        )
        
    content_type = (request.headers.get("content-type") or "").lower()
    prompt_value: Optional[str] = None

    if "multipart/form-data" in content_type or "application/x-www-form-urlencoded" in content_type:
        form_data = await request.form()
        raw_prompt = form_data.get("prompt")
        if raw_prompt is not None:
            prompt_value = str(raw_prompt)
    else:
        try:
            payload_dict = await request.json()
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="JSON inválido no corpo da requisição.")
        if not isinstance(payload_dict, dict):
            raise HTTPException(status_code=400, detail="Payload inválido. Esperado objeto JSON.")
        raw_prompt = payload_dict.get("prompt")
        if raw_prompt is not None:
            prompt_value = str(raw_prompt)

    try:
        parsed_payload = AdjustmentRequest(prompt=prompt_value or "")
    except ValidationError as exc:
        raise HTTPException(status_code=422, detail=exc.errors())

    loop = asyncio.get_running_loop()
    submit_adjustment(loop, job_id, item_id, parsed_payload.prompt)
    logger.info(f"[job:{job_id}] Ajuste enfileirado para o item {item_id}.")
    
    return {"status": "accepted", "message": "Ajuste enfileirado com sucesso"}

@app.post(
    "/banners",
    response_model=JobCreatedResponse,
    status_code=202,
    tags=["Banners"],
    summary="Submeter job de geração de banner (Multipart)",
)
async def create_banner_job(
    modo_geracao: GenerationMode = Form(GenerationMode.PECA_UNICA, description="Modo de geração: peca_unica ou enxoval"),
    canal: Optional[str] = Form(None, description="Canal (obrigatório em peca_unica)"),
    kv: str = Form(..., description="KV (ex: graduacao)"),
    etiqueta: str = Form(..., description="Texto da etiqueta"),
    titulo: str = Form("", description="Título principal (vazio para KVs sem título)"),
    frase: str = Form(..., description="Frase de apoio"),
    box1: str = Form(..., description="Texto Box 1"),
    box2: str = Form("", description="Texto Box 2 (opcional)"),
    persona: Optional[str] = Form(None, description="Descrição visual da persona"),
    persona_desc: Optional[str] = Form(None, description="Campo legado para descrição da persona"),
    persona_image: Optional[UploadFile] = File(None, description="Arquivo de imagem da persona (PNG/JPG)"),
    x_user_id: Optional[str] = Header(None, alias="x-user-id"),
):
    """
    Recebe os dados do banner e dispara o pipeline em background.
    Aceita Multipart Form-Data para suportar upload de arquivos.
    """
    
    # 1. Processar Upload da Persona (se houver)
    persona_image_path = None
    if persona_image:
        try:
            file_ext = Path(persona_image.filename).suffix
            if file_ext.lower() not in [".png", ".jpg", ".jpeg"]:
                 raise HTTPException(status_code=400, detail="Apenas PNG e JPG são permitidos.")
            
            temp_filename = f"{uuid.uuid4()}{file_ext}"
            temp_path = UPLOADS_DIR / temp_filename
            
            with open(temp_path, "wb") as buffer:
                shutil.copyfileobj(persona_image.file, buffer)
            
            persona_image_path = str(temp_path.absolute())
            logger.info(f"Imagem de persona salva em: {persona_image_path}")
            
        except Exception as e:
            logger.error(f"Erro ao salvar upload: {e}")
            raise HTTPException(status_code=500, detail="Falha ao processar upload da imagem.")

    persona_value = _resolve_persona_value(persona, persona_desc)
    return await _create_and_submit_job(
        modo_geracao=modo_geracao,
        canal=canal,
        kv=kv,
        etiqueta=etiqueta,
        titulo=titulo,
        frase=frase,
        box1=box1,
        box2=box2,
        persona=persona_value,
        persona_image_path=persona_image_path,
        requested_by=x_user_id,
    )

@app.post(
    "/banners/json",
    response_model=JobCreatedResponse,
    status_code=202,
    tags=["Banners"],
    summary="Submeter job de geração de banner (JSON)",
)
async def create_banner_job_json(
    payload: FrontendBannerRequest,
    x_user_id: Optional[str] = Header(None, alias="x-user-id"),
):
    return await _create_and_submit_job(
        modo_geracao=payload.modo_geracao,
        canal=payload.canal,
        kv=payload.kv,
        etiqueta=payload.etiqueta,
        titulo=payload.titulo,
        frase=payload.frase,
        box1=payload.box1,
        box2=payload.box2,
        persona=payload.persona,
        persona_image_path=None,
        requested_by=x_user_id,
    )

@app.get(
    "/templates",
    response_model=TemplatesResponse,
    tags=["Banners"],
    summary="Listar catálogo de templates por canal/KV",
)
def get_templates():
    templates, canais, kvs = _templates_catalog()
    total_templates = sum(len(files) for kv_map in templates.values() for files in kv_map.values())
    return TemplatesResponse(
        templates=templates,
        total_canals=len(canais),
        total_kvs=len(kvs),
        total_templates=total_templates,
    )

@app.get(
    "/banners/form-options",
    response_model=FormOptionsResponse,
    tags=["Banners"],
    summary="Listar opções para formulário de integração frontend",
)
def get_form_options():
    templates, canais, kvs = _templates_catalog()
    return FormOptionsResponse(
        modos_geracao=[mode.value for mode in GenerationMode],
        canais_enxoval=list(ENXOVAL_CHANNELS),
        canais_disponiveis=canais,
        kvs_disponiveis=kvs,
        templates=templates,
    )

@app.get(
    "/banners/{job_id}",
    response_model=JobStatusResponse,
    tags=["Banners"],
    summary="Consultar status do job",
)
def get_banner_job(job_id: str):
    """
    Consulta o status de um job de geração.
    """
    _validate_job_id(job_id)
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' não encontrado.")
    return JobStatusResponse(**job.model_dump())


@app.get(
    "/banners/metrics/enxoval",
    response_model=EnxovalMetricsResponse,
    tags=["Banners"],
    summary="Consultar métricas agregadas de enxoval",
)
def get_enxoval_metrics():
    return EnxovalMetricsResponse(**get_enxoval_metrics_summary())

@app.get(
    "/banners/{job_id}/download",
    tags=["Banners"],
    summary="Download direto do PNG gerado",
)
def download_banner(job_id: str):
    """
    Retorna o arquivo PNG gerado quando o job estiver `done`.
    """
    _validate_job_id(job_id)
    job = get_job(job_id)
    if not job:
         raise HTTPException(status_code=404, detail="Job não encontrado.")
    
    if job.status != JobStatus.DONE:
        raise HTTPException(status_code=400, detail="Job ainda não concluído.")
        
    if not job.file_url:
        raise HTTPException(status_code=500, detail="URL do arquivo não disponível.")

    if job.file_url.startswith("http://") or job.file_url.startswith("https://"):
        return RedirectResponse(job.file_url)

    filename = Path(job.file_url).name
    file_path = OUTPUTS_DIR / filename
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Arquivo físico não encontrado.")
        
    return FileResponse(file_path, media_type="image/png", filename=filename)


@app.post(
    "/banners/{job_id}/items/{item_id}/refresh-url",
    response_model=RefreshSignedUrlResponse,
    tags=["Banners"],
    summary="Renovar signed URL de um item do job",
)
def refresh_banner_item_url(job_id: str, item_id: str):
    _validate_job_id(job_id)
    try:
        uuid.UUID(item_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="item_id inválido.")
    try:
        item = refresh_job_item_signed_url(job_id, item_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return RefreshSignedUrlResponse(
        job_id=job_id,
        item_id=item.item_id,
        file_url=item.file_url or "",
        signed_url_expires_at=item.signed_url_expires_at,
    )
