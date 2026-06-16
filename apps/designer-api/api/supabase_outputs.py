import os
import mimetypes
from datetime import datetime, timedelta, timezone
from pathlib import Path
from time import sleep
from typing import Any, Optional

from dotenv import load_dotenv

try:
    from supabase import Client, create_client
except ImportError:
    Client = Any  # type: ignore[assignment]
    create_client = None

load_dotenv()

_client: Optional[Client] = None


def is_supabase_outputs_enabled() -> bool:
    return bool(create_client and _env("SUPABASE_URL") and _env("SUPABASE_SERVICE_ROLE_KEY"))


def upload_output_to_supabase(
    *,
    local_path: Path,
    job_id: str,
    item_id: str,
    canal: str,
    kv: str,
    requested_by: Optional[str],
) -> dict[str, str]:
    bucket = _env("SUPABASE_OUTPUTS_BUCKET", "image-gen-outputs")
    expires_in = int(_env("SUPABASE_SIGNED_URL_EXPIRES_SECONDS", "3600"))
    object_path = f"{job_id}/{canal}/{item_id}.png"
    client = _get_client()
    content_type = mimetypes.guess_type(local_path.name)[0] or "image/png"
    _upload_with_retry(client, bucket, object_path, local_path, content_type)
    signed_url = _create_signed_url(client, bucket, object_path, expires_in)
    _persist_output_metadata(
        client=client,
        job_id=job_id,
        item_id=item_id,
        canal=canal,
        kv=kv,
        requested_by=requested_by,
        bucket=bucket,
        object_path=object_path,
        content_type=content_type,
        size_bytes=local_path.stat().st_size,
    )
    expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)
    return {
        "storage_path": object_path,
        "signed_url": signed_url,
        "signed_url_expires_at": expires_at.isoformat().replace("+00:00", "Z"),
    }


def refresh_signed_output_url(storage_path: str) -> dict[str, str]:
    bucket = _env("SUPABASE_OUTPUTS_BUCKET", "image-gen-outputs")
    expires_in = int(_env("SUPABASE_SIGNED_URL_EXPIRES_SECONDS", "3600"))
    client = _get_client()
    signed_url = _create_signed_url(client, bucket, storage_path, expires_in)
    expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)
    return {
        "signed_url": signed_url,
        "signed_url_expires_at": expires_at.isoformat().replace("+00:00", "Z"),
    }


def _upload_with_retry(client: Client, bucket: str, object_path: str, local_path: Path, content_type: str) -> None:
    max_attempts = int(_env("SUPABASE_UPLOAD_MAX_ATTEMPTS", "3"))
    backoff = float(_env("SUPABASE_UPLOAD_BACKOFF_SECONDS", "1"))
    last_error: Optional[Exception] = None
    for attempt in range(1, max_attempts + 1):
        try:
            with open(local_path, "rb") as file_obj:
                client.storage.from_(bucket).upload(
                    object_path,
                    file_obj,
                    {
                        "content-type": content_type,
                        "upsert": "true",
                    },
                )
            return
        except Exception as error:
            last_error = error
            if attempt >= max_attempts:
                break
            sleep(backoff * attempt)
    if last_error:
        raise last_error


def _persist_output_metadata(
    *,
    client: Client,
    job_id: str,
    item_id: str,
    canal: str,
    kv: str,
    requested_by: Optional[str],
    bucket: str,
    object_path: str,
    content_type: str,
    size_bytes: int,
) -> None:
    payload = {
        "job_id": job_id,
        "item_id": item_id,
        "requested_by": requested_by,
        "canal": canal,
        "kv": kv,
        "storage_bucket": bucket,
        "storage_path": object_path,
        "mime_type": content_type,
        "file_size_bytes": size_bytes,
    }
    client.schema("image_gen").table("outputs").upsert(payload, on_conflict="item_id").execute()


def _create_signed_url(client: Client, bucket: str, storage_path: str, expires_in: int) -> str:
    result = client.storage.from_(bucket).create_signed_url(storage_path, expires_in)
    signed = _extract_signed_url(result)
    if not signed:
        raise RuntimeError("Falha ao criar signed URL do Supabase Storage.")
    return signed


def _extract_signed_url(result: Any) -> Optional[str]:
    if isinstance(result, str):
        return result
    if isinstance(result, dict):
        for key in ("signedURL", "signedUrl", "signed_url"):
            value = result.get(key)
            if isinstance(value, str) and value:
                return value
        data = result.get("data")
        if isinstance(data, dict):
            for key in ("signedURL", "signedUrl", "signed_url"):
                value = data.get(key)
                if isinstance(value, str) and value:
                    return value
    return None


def _get_client() -> Client:
    global _client
    if _client is not None:
        return _client
    if create_client is None:
        raise RuntimeError("Dependência 'supabase' não instalada no ambiente Python.")
    url = _env("SUPABASE_URL")
    key = _env("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise RuntimeError("SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios.")
    _client = create_client(url, key)
    return _client


def _env(key: str, default: Optional[str] = None) -> Optional[str]:
    value = os.getenv(key, default)
    if value is None:
        return None
    return str(value).strip()
