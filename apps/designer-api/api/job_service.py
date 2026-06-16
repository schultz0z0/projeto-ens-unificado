import logging
import math
import os
import sys
import uuid
from concurrent.futures import ThreadPoolExecutor
from copy import deepcopy
from datetime import datetime, timedelta, timezone
from collections import deque
from enum import Enum
from pathlib import Path
from threading import Lock
from typing import Optional
import time

from pydantic import BaseModel, Field

sys.path.insert(0, str(Path(__file__).parent.parent))

from main import BannerRequest, editable_output_path_for_delivery, generate_banner
from api.supabase_outputs import is_supabase_outputs_enabled, refresh_signed_output_url, upload_output_to_supabase, _get_client

logger = logging.getLogger("ens.api.jobs")

ENXOVAL_CHANNELS: tuple[str, ...] = (
    "01_feed_instagram",
    "03_banner_interno_desktop",
    "04_banner_interno_mobile",
    "05_whatsapp",
    "08_topo_email",
)


def _resolve_local_adjustment_base_path(output_path: Path) -> Path:
    editable_path = editable_output_path_for_delivery(output_path)
    if editable_path.exists():
        return editable_path
    return output_path


class JobStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    DONE = "done"
    PARTIAL_DONE = "partial_done"
    FAILED = "failed"


class JobItemStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    DONE = "done"
    FAILED = "failed"


class JobItemRecord(BaseModel):
    item_id: str
    canal: str
    kv: str
    status: JobItemStatus = JobItemStatus.PENDING
    file_url: Optional[str] = None
    storage_path: Optional[str] = None
    signed_url_expires_at: Optional[str] = None
    error: Optional[str] = None
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    elapsed_seconds: Optional[float] = None


class JobMetrics(BaseModel):
    started_at: Optional[str] = None
    updated_at: Optional[str] = None
    elapsed_seconds_total: float = 0.0
    elapsed_seconds_by_channel: dict[str, float] = Field(default_factory=dict)
    estimated_seconds_remaining: float = 0.0
    estimated_completion_at: Optional[str] = None


class JobRecord(BaseModel):
    job_id: str
    status: JobStatus = JobStatus.PENDING
    created_at: str
    updated_at: str
    modo_geracao: str
    requested_by: Optional[str] = None
    progress: str
    itens: list[JobItemRecord]
    metrics: JobMetrics
    file_url: Optional[str] = None
    error: Optional[str] = None


_jobs: dict[str, JobRecord] = {}
_executor = ThreadPoolExecutor(max_workers=int(os.getenv("WORKER_THREADS", "2")))
_enxoval_seconds_history: deque[float] = deque(maxlen=30)
_channel_seconds_history: deque[float] = deque(maxlen=150)
_last_metrics_updated_at: Optional[str] = None
_metrics_lock = Lock()
_global_throttle_lock = Lock()
_last_piece_started_at_monotonic: Optional[float] = None
_min_seconds_between_pieces = max(0.0, float(os.getenv("MIN_SECONDS_BETWEEN_PIECES", "3")))


def _persist_job_to_supabase(job: JobRecord) -> None:
    if not is_supabase_outputs_enabled():
        return
    try:
        client = _get_client()
        job_payload = {
            "id": job.job_id,
            "modo_geracao": job.modo_geracao,
            "status": job.status.value if hasattr(job.status, "value") else str(job.status),
            "briefing": {},
            "kv": next((i.kv for i in job.itens if i.kv), ""),
            "requested_by": job.requested_by,
            "created_at": job.created_at,
            "updated_at": job.updated_at,
            "progress": job.progress,
            "file_url": job.file_url,
            "error": job.error
        }
        client.schema("image_gen").table("jobs").upsert(job_payload).execute()
        
        for item in job.itens:
            item_payload = {
                "id": item.item_id,
                "job_id": job.job_id,
                "canal": item.canal,
                "kv": item.kv,
                "status": item.status.value if hasattr(item.status, "value") else str(item.status),
                "file_url": item.file_url,
                "storage_path": item.storage_path,
                "signed_url_expires_at": item.signed_url_expires_at,
                "error": item.error,
                "local_output_path": getattr(item, "_local_output_path", None),
                "started_at": item.started_at,
                "completed_at": item.completed_at,
                "elapsed_seconds": item.elapsed_seconds
            }
            client.schema("image_gen").table("job_items").upsert(item_payload).execute()

        metrics_payload = {
            "job_id": job.job_id,
            "elapsed_seconds_total": job.metrics.elapsed_seconds_total,
            "elapsed_seconds_by_channel": job.metrics.elapsed_seconds_by_channel,
            "estimated_seconds_remaining": job.metrics.estimated_seconds_remaining,
            "estimated_completion_at": job.metrics.estimated_completion_at,
            "started_at": job.metrics.started_at,
            "updated_at": job.metrics.updated_at
        }
        client.schema("image_gen").table("job_metrics").upsert(metrics_payload).execute()
    except Exception as e:
        logger.error(f"[job:{job.job_id}] Erro ao persistir no Supabase: {e}")

def create_job(modo_geracao: str, raw_request: dict) -> JobRecord:
    now = _now_iso()
    job_id = str(uuid.uuid4())
    channels = _resolve_channels_for_mode(modo_geracao, raw_request)
    kv = str(raw_request.get("request_meta", {}).get("kv", "")).strip()
    requested_by = _extract_requested_by(raw_request)
    items = [
        JobItemRecord(
            item_id=str(uuid.uuid4()),
            canal=channel,
            kv=kv,
        )
        for channel in channels
    ]
    job = JobRecord(
        job_id=job_id,
        status=JobStatus.PENDING,
        created_at=now,
        updated_at=now,
        modo_geracao=modo_geracao,
        requested_by=requested_by,
        progress=f"0/{len(items)}",
        itens=items,
        metrics=JobMetrics(started_at=now, updated_at=now),
    )
    _jobs[job_id] = job
    _persist_job_to_supabase(job)
    return job


def get_job(job_id: str) -> Optional[JobRecord]:
    job = _jobs.get(job_id)
    if job:
        return job
        
    if is_supabase_outputs_enabled():
        try:
            client = _get_client()
            job_res = client.schema("image_gen").table("jobs").select("*").eq("id", job_id).execute()
            if not job_res.data:
                return None
                
            job_data = job_res.data[0]
            items_res = client.schema("image_gen").table("job_items").select("*").eq("job_id", job_id).execute()
            metrics_res = client.schema("image_gen").table("job_metrics").select("*").eq("job_id", job_id).execute()
            
            items = []
            for idata in items_res.data:
                items.append(JobItemRecord(
                    item_id=idata["id"],
                    canal=idata["canal"],
                    kv=idata["kv"],
                    status=JobItemStatus(idata["status"]),
                    file_url=idata["file_url"],
                    storage_path=idata["storage_path"],
                    signed_url_expires_at=idata.get("signed_url_expires_at"),
                    error=idata.get("error"),
                    started_at=idata.get("started_at"),
                    completed_at=idata.get("completed_at"),
                    elapsed_seconds=idata.get("elapsed_seconds")
                ))
                # Restore local path tracking if any
                if idata.get("local_output_path"):
                    setattr(items[-1], "_local_output_path", idata["local_output_path"])
                    
            metrics_data = metrics_res.data[0] if metrics_res.data else {}
            metrics = JobMetrics(
                started_at=metrics_data.get("started_at"),
                updated_at=metrics_data.get("updated_at"),
                elapsed_seconds_total=metrics_data.get("elapsed_seconds_total", 0.0),
                elapsed_seconds_by_channel=metrics_data.get("elapsed_seconds_by_channel", {}),
                estimated_seconds_remaining=metrics_data.get("estimated_seconds_remaining", 0.0),
                estimated_completion_at=metrics_data.get("estimated_completion_at")
            )
            
            loaded_job = JobRecord(
                job_id=job_data["id"],
                status=JobStatus(job_data["status"]),
                created_at=job_data["created_at"],
                updated_at=job_data["updated_at"],
                modo_geracao=job_data["modo_geracao"],
                requested_by=job_data.get("requested_by"),
                progress=job_data.get("progress", "0/0"),
                itens=items,
                metrics=metrics,
                file_url=job_data.get("file_url"),
                error=job_data.get("error")
            )
            _jobs[job_id] = loaded_job
            return loaded_job
        except Exception as e:
            logger.error(f"Erro ao recuperar job do Supabase: {e}")
            
    return None


def count_jobs() -> int:
    return len(_jobs)

def resume_interrupted_jobs(loop) -> None:
    """Recupera jobs interrompidos do Supabase e os re-enfileira."""
    if not is_supabase_outputs_enabled():
        return
    try:
        client = _get_client()
        # Busca jobs que estavam rodando ou pendentes
        res = client.schema("image_gen").table("jobs").select("id").in_("status", ["pending", "running"]).execute()
        if not res.data:
            return
            
        logger.info(f"Encontrados {len(res.data)} jobs interrompidos para retomada.")
        for job_record in res.data:
            job_id = job_record["id"]
            job = get_job(job_id)
            if job:
                # Aqui assumimos que, se o servidor reiniciou, precisamos rodar de novo
                # Poderíamos checar item a item, mas para simplificar re-submetemos o pipeline
                # Nota: Na vida real, o ideal seria retomar apenas os itens 'pending' ou 'running'
                logger.info(f"Retomando job: {job_id}")
                # Para evitar dependência circular pesada, vamos apenas marcar como failed para que o usuário tente de novo,
                # ou poderíamos reconstruir o raw_request (que está no briefing).
                # Como guardamos briefing vazio no momento, vamos marcar como failed com mensagem de reinício.
                
                # Vamos atualizar para FAILED para não ficar pendurado eternamente,
                # já que o briefing original (raw_request) não foi totalmente salvo no Supabase no _persist_job_to_supabase
                job.status = JobStatus.FAILED
                job.error = "Job interrompido por reinício do servidor."
                _persist_job_to_supabase(job)
    except Exception as e:
        logger.error(f"Erro ao recuperar jobs interrompidos: {e}")


def submit_job(loop, job_id: str, raw_request: dict) -> None:
    loop.run_in_executor(_executor, _run_pipeline_sync, job_id, raw_request)

def submit_adjustment(
    loop,
    job_id: str,
    item_id: str,
    prompt: str,
) -> None:
    loop.run_in_executor(_executor, _run_adjustment_sync, job_id, item_id, prompt)


def _run_pipeline_sync(job_id: str, raw_request: dict) -> None:
    job = _jobs.get(job_id)
    if not job:
        logger.error(f"[job:{job_id}] Job não encontrado em memória.")
        return
    job.status = JobStatus.RUNNING
    job.updated_at = _now_iso()
    job.metrics.started_at = job.updated_at
    job.metrics.updated_at = job.updated_at
    logger.info(f"[job:{job_id}] Pipeline iniciado.")
    job_started_monotonic = time.perf_counter()
    for item in job.itens:
        _respect_global_throttle()
        item.status = JobItemStatus.RUNNING
        item.started_at = _now_iso()
        job.updated_at = _now_iso()
        job.metrics.updated_at = job.updated_at
        _update_progress(job)
        channel_started_monotonic = time.perf_counter()
        try:
            item_request = deepcopy(raw_request)
            item_request.setdefault("request_meta", {})
            item_request["request_meta"]["canal"] = item.canal
            request = BannerRequest.model_validate(item_request)
            output_path: Path = generate_banner(request)
            
            if is_supabase_outputs_enabled():
                upload_result = upload_output_to_supabase(
                    local_path=output_path,
                    job_id=job.job_id,
                    item_id=item.item_id,
                    canal=item.canal,
                    kv=item.kv,
                    requested_by=job.requested_by,
                )
                item.file_url = upload_result["signed_url"]
                item.storage_path = upload_result["storage_path"]
                item.signed_url_expires_at = upload_result["signed_url_expires_at"]
            else:
                item.file_url = f"/files/{output_path.name}"
            
            # Armazena o path local para uso no ajuste
            local_adjustment_path = _resolve_local_adjustment_base_path(output_path)
            setattr(item, "_local_output_path", str(local_adjustment_path.absolute()))
            
            item.status = JobItemStatus.DONE
            item.error = None
            item.completed_at = _now_iso()
            item.elapsed_seconds = round(max(0.0, time.perf_counter() - channel_started_monotonic), 3)
            job.metrics.elapsed_seconds_by_channel[item.canal] = item.elapsed_seconds
            logger.info(f"[job:{job_id}] ✓ Canal concluído: {item.canal} → {item.file_url}")
        except Exception as exc:
            item.status = JobItemStatus.FAILED
            item.error = str(exc)
            item.completed_at = _now_iso()
            item.elapsed_seconds = round(max(0.0, time.perf_counter() - channel_started_monotonic), 3)
            job.metrics.elapsed_seconds_by_channel[item.canal] = item.elapsed_seconds
            logger.error(f"[job:{job_id}] ✗ Falha no canal {item.canal}: {exc}")
        finally:
            job.updated_at = _now_iso()
            job.metrics.updated_at = job.updated_at
            _update_eta(job)
            _update_progress(job)
            _persist_job_to_supabase(job)

    _update_job_status_after_items(job, job_started_monotonic)


def _run_adjustment_sync(
    job_id: str,
    item_id: str,
    prompt: str,
) -> None:
    job = _jobs.get(job_id)
    if not job:
        logger.error(f"[job:{job_id}] Job não encontrado para ajuste.")
        return
        
    item = next((i for i in job.itens if i.item_id == item_id), None)
    if not item:
        logger.error(f"[job:{job_id}] Item {item_id} não encontrado.")
        return

    job.status = JobStatus.RUNNING
    job.updated_at = _now_iso()
    
    _respect_global_throttle()
    item.status = JobItemStatus.RUNNING
    item.started_at = _now_iso()
    job.updated_at = _now_iso()
    _update_progress(job)
    
    channel_started_monotonic = time.perf_counter()
    try:
        from main import NexusImageOrchestrator
        orchestrator = NexusImageOrchestrator()
        
        local_image_path = None
        if hasattr(item, "_local_output_path") and item._local_output_path:
            local_image_path = Path(item._local_output_path)
            if local_image_path.exists():
                local_image_path = _resolve_local_adjustment_base_path(local_image_path)
            
        if not local_image_path or not local_image_path.exists():
            # Tenta recuperar baseado no URL se for local
            if item.file_url and item.file_url.startswith("/files/"):
                base_image_name = item.file_url.split("/")[-1]
                local_image_path = Path("outputs") / base_image_name
                if local_image_path.exists():
                    local_image_path = _resolve_local_adjustment_base_path(local_image_path)
                
            # Fallback de Download via Supabase
            if (not local_image_path or not local_image_path.exists()) and item.file_url and item.file_url.startswith("http"):
                logger.info(f"[job:{job_id}] Imagem local não encontrada. Baixando do Supabase: {item.file_url[:50]}...")
                import urllib.request
                import tempfile
                
                temp_dir = Path(tempfile.gettempdir()) / "nexus_adjustments"
                temp_dir.mkdir(parents=True, exist_ok=True)
                downloaded_path = temp_dir / f"downloaded_{item.item_id}.png"
                
                try:
                    req = urllib.request.Request(item.file_url, headers={'User-Agent': 'Mozilla/5.0'})
                    with urllib.request.urlopen(req) as response, open(downloaded_path, 'wb') as out_file:
                        out_file.write(response.read())
                    local_image_path = downloaded_path
                    logger.info(f"[job:{job_id}] Download concluído com sucesso: {local_image_path}")
                except Exception as e:
                    logger.error(f"[job:{job_id}] Falha ao baixar imagem do Supabase: {e}")
                    raise FileNotFoundError(f"Falha ao baixar imagem base para ajuste: {e}")

            if not local_image_path or not local_image_path.exists():
                raise FileNotFoundError("Imagem base não encontrada localmente nem no Supabase para ajuste. Use gerar novamente.")

        output_path: Path = orchestrator.process_adjustment(
            local_image_path,
            prompt,
        )
        
        if is_supabase_outputs_enabled():
            upload_result = upload_output_to_supabase(
                local_path=output_path,
                job_id=job.job_id,
                item_id=item.item_id,
                canal=item.canal,
                kv=item.kv,
                requested_by=job.requested_by,
            )
            item.file_url = upload_result["signed_url"]
            item.storage_path = upload_result["storage_path"]
            item.signed_url_expires_at = upload_result["signed_url_expires_at"]
        else:
            item.file_url = f"/files/{output_path.name}"
            
        local_adjustment_path = _resolve_local_adjustment_base_path(output_path)
        setattr(item, "_local_output_path", str(local_adjustment_path.absolute()))
        item.status = JobItemStatus.DONE
        item.error = None
        item.completed_at = _now_iso()
        elapsed = round(max(0.0, time.perf_counter() - channel_started_monotonic), 3)
        if item.elapsed_seconds:
            item.elapsed_seconds += elapsed
        else:
            item.elapsed_seconds = elapsed
            
        logger.info(f"[job:{job_id}] ✓ Ajuste concluído: {item.canal} → {item.file_url}")
    except Exception as exc:
        item.status = JobItemStatus.FAILED
        item.error = str(exc)
        item.completed_at = _now_iso()
        logger.error(f"[job:{job_id}] ✗ Falha no ajuste {item.canal}: {exc}")
    finally:
        job.updated_at = _now_iso()
        _update_progress(job)
        _persist_job_to_supabase(job)
        
    _update_job_status_after_items(job, time.perf_counter(), is_adjustment=True)


def _update_job_status_after_items(job: JobRecord, start_monotonic: float, is_adjustment: bool = False):
    done_items = [item for item in job.itens if item.status == JobItemStatus.DONE]
    failed_items = [item for item in job.itens if item.status == JobItemStatus.FAILED]
    has_incomplete_items = any(item.status in {JobItemStatus.PENDING, JobItemStatus.RUNNING} for item in job.itens)
    if is_adjustment and has_incomplete_items:
        job.status = JobStatus.RUNNING
    elif done_items and not failed_items:
        job.status = JobStatus.DONE
    elif done_items and failed_items:
        job.status = JobStatus.PARTIAL_DONE
    else:
        job.status = JobStatus.FAILED
    if done_items:
        job.file_url = done_items[-1].file_url
    if failed_items and not done_items:
        job.error = failed_items[0].error
    if failed_items and done_items:
        job.error = f"{len(failed_items)} canal(is) falharam."
    
    if not is_adjustment:
        job.metrics.elapsed_seconds_total = round(max(0.0, time.perf_counter() - start_monotonic), 3)
        job.metrics.estimated_seconds_remaining = 0.0
        job.metrics.estimated_completion_at = _now_iso()
        _append_metrics_history(job)
    
    job.updated_at = _now_iso()
    job.metrics.updated_at = job.updated_at
    _persist_job_to_supabase(job)


def _resolve_channels_for_mode(modo_geracao: str, raw_request: dict) -> list[str]:
    if modo_geracao == "enxoval":
        return list(ENXOVAL_CHANNELS)
    canal = str(raw_request.get("request_meta", {}).get("canal", "")).strip()
    if canal:
        return [canal]
    raise ValueError("Modo peca_unica requer canal válido.")


def _update_progress(job: JobRecord) -> None:
    total = len(job.itens)
    completed = sum(1 for item in job.itens if item.status in {JobItemStatus.DONE, JobItemStatus.FAILED})
    job.progress = f"{completed}/{total}"


def get_enxoval_metrics_summary() -> dict:
    with _metrics_lock:
        samples = list(_enxoval_seconds_history)
        channel_samples = list(_channel_seconds_history)
        sample_size = len(samples)
        avg_seconds_per_channel = round(sum(channel_samples) / len(channel_samples), 3) if channel_samples else 0.0
        avg_seconds_per_enxoval = round(sum(samples) / sample_size, 3) if sample_size else 0.0
        p95_seconds_per_enxoval = _compute_p95(samples)
        return {
            "avg_seconds_per_channel": avg_seconds_per_channel,
            "avg_seconds_per_enxoval": avg_seconds_per_enxoval,
            "p95_seconds_per_enxoval": p95_seconds_per_enxoval,
            "sample_size": sample_size,
            "last_updated_at": _last_metrics_updated_at,
        }


def refresh_job_item_signed_url(job_id: str, item_id: str) -> JobItemRecord:
    job = _jobs.get(job_id)
    if not job:
        raise ValueError("Job não encontrado.")
    for item in job.itens:
        if item.item_id != item_id:
            continue
        if not item.storage_path:
            raise ValueError("Item não possui storage_path para renovação de URL.")
        if not is_supabase_outputs_enabled():
            raise RuntimeError("Integração Supabase de outputs não está habilitada.")
        refreshed = refresh_signed_output_url(item.storage_path)
        item.file_url = refreshed["signed_url"]
        item.signed_url_expires_at = refreshed["signed_url_expires_at"]
        job.updated_at = _now_iso()
        _persist_job_to_supabase(job)
        return item
    raise ValueError("Item do job não encontrado.")


def _append_metrics_history(job: JobRecord) -> None:
    global _last_metrics_updated_at
    if job.modo_geracao != "enxoval":
        return
    if job.status == JobStatus.FAILED:
        return
    with _metrics_lock:
        _enxoval_seconds_history.append(job.metrics.elapsed_seconds_total)
        for item in job.itens:
            if item.status == JobItemStatus.DONE and item.elapsed_seconds is not None:
                _channel_seconds_history.append(item.elapsed_seconds)
        _last_metrics_updated_at = _now_iso()


def _compute_p95(values: list[float]) -> float:
    if not values:
        return 0.0
    sorted_values = sorted(values)
    index = max(0, math.ceil(0.95 * len(sorted_values)) - 1)
    return round(sorted_values[index], 3)


def _update_eta(job: JobRecord) -> None:
    total_items = len(job.itens)
    completed_items = sum(1 for item in job.itens if item.status in {JobItemStatus.DONE, JobItemStatus.FAILED})
    remaining_items = max(0, total_items - completed_items)
    if remaining_items == 0:
        job.metrics.estimated_seconds_remaining = 0.0
        job.metrics.estimated_completion_at = _now_iso()
        return
    avg_per_channel = _estimate_avg_seconds_per_channel(job)
    raw_remaining = max(0.0, avg_per_channel * remaining_items)
    rounded_remaining = float(math.ceil(raw_remaining / 15.0) * 15.0) if raw_remaining > 0 else 0.0
    job.metrics.estimated_seconds_remaining = rounded_remaining
    eta_dt = datetime.now(timezone.utc) + timedelta(seconds=rounded_remaining)
    job.metrics.estimated_completion_at = eta_dt.isoformat().replace("+00:00", "Z")


def _estimate_avg_seconds_per_channel(job: JobRecord) -> float:
    with _metrics_lock:
        if _channel_seconds_history:
            return sum(_channel_seconds_history) / len(_channel_seconds_history)
    current_samples = [
        item.elapsed_seconds for item in job.itens
        if item.elapsed_seconds is not None and item.status in {JobItemStatus.DONE, JobItemStatus.FAILED}
    ]
    if current_samples:
        return sum(current_samples) / len(current_samples)
    return 60.0


def _respect_global_throttle() -> None:
    global _last_piece_started_at_monotonic
    if _min_seconds_between_pieces <= 0:
        return
    with _global_throttle_lock:
        now = time.monotonic()
        if _last_piece_started_at_monotonic is not None:
            elapsed = now - _last_piece_started_at_monotonic
            wait_seconds = _min_seconds_between_pieces - elapsed
            if wait_seconds > 0:
                time.sleep(wait_seconds)
                now = time.monotonic()
        _last_piece_started_at_monotonic = now


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _extract_requested_by(raw_request: dict) -> Optional[str]:
    request_meta = raw_request.get("request_meta", {})
    raw_value = str(request_meta.get("requested_by", "")).strip()
    if not raw_value:
        return None
    try:
        return str(uuid.UUID(raw_value))
    except ValueError:
        return None
