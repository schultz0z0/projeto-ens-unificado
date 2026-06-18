"""OpenAI image generation backend.

Exposes OpenAI's ``gpt-image-2`` model at three quality tiers as an
:class:`ImageGenProvider` implementation. The tiers are implemented as
three virtual model IDs so the ``hermes tools`` model picker and the
``image_gen.model`` config key behave like any other multi-model backend:

    gpt-image-2-low     ~15s   fastest, good for iteration
    gpt-image-2-medium  ~40s   default — balanced
    gpt-image-2-high    ~2min  slowest, highest fidelity

All three hit the same underlying API model (``gpt-image-2``) with a
different ``quality`` parameter. Output is base64 JSON → saved under
``$HERMES_HOME/cache/images/``.

Selection precedence (first hit wins):

1. ``OPENAI_IMAGE_MODEL`` env var (escape hatch for scripts / tests)
2. ``image_gen.openai.model`` in ``config.yaml``
3. ``image_gen.model`` in ``config.yaml`` (when it's one of our tier IDs)
4. :data:`DEFAULT_MODEL` — ``gpt-image-2-medium``
"""

from __future__ import annotations

import logging
import os
import re
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import quote, urljoin

from agent.image_gen_provider import (
    DEFAULT_ASPECT_RATIO,
    ImageGenProvider,
    error_response,
    resolve_aspect_ratio,
    save_b64_image,
    save_url_image,
    success_response,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Model catalog
# ---------------------------------------------------------------------------
#
# All three IDs resolve to the same underlying API model with a different
# ``quality`` setting. ``api_model`` is what gets sent to OpenAI;
# ``quality`` is the knob that changes generation time and output fidelity.

API_MODEL = "gpt-image-2"

_MODELS: Dict[str, Dict[str, Any]] = {
    "gpt-image-2-low": {
        "display": "GPT Image 2 (Low)",
        "speed": "~15s",
        "strengths": "Fast iteration, lowest cost",
        "quality": "low",
    },
    "gpt-image-2-medium": {
        "display": "GPT Image 2 (Medium)",
        "speed": "~40s",
        "strengths": "Balanced — default",
        "quality": "medium",
    },
    "gpt-image-2-high": {
        "display": "GPT Image 2 (High)",
        "speed": "~2min",
        "strengths": "Highest fidelity, strongest prompt adherence",
        "quality": "high",
    },
}

DEFAULT_MODEL = "gpt-image-2-medium"

_SIZES = {
    "landscape": "1536x1024",
    "square": "1024x1024",
    "portrait": "1024x1536",
}

_QUALITY_VALUES = {"auto", "low", "medium", "high"}
_OUTPUT_FORMATS = {"png", "jpeg", "webp"}
_EXPLICIT_SIZES = {
    "auto",
    "1024x1024",
    "1536x1024",
    "1024x1536",
    "2048x2048",
    "2048x1152",
    "1152x2048",
    "2560x1440",
    "1440x2560",
    "3840x2160",
    "2160x3840",
}

_SUPABASE_IMAGE_PREFIX = "hermes-chat-images"


def _env(name: str, default: str = "") -> str:
    return str(os.environ.get(name, default) or "").strip()


def _env_bool(name: str, default: bool = False) -> bool:
    value = _env(name)
    if not value:
        return default
    return value.lower() in {"1", "true", "yes", "y", "on"}


def _sanitize_storage_segment(value: Any, fallback: str = "session") -> str:
    sanitized = re.sub(r"[^a-zA-Z0-9._=-]+", "-", str(value or "").strip())
    sanitized = re.sub(r"-+", "-", sanitized).strip("-")[:160]
    return sanitized or fallback


def _encode_storage_path(storage_path: str) -> str:
    return "/".join(quote(segment, safe="") for segment in storage_path.split("/"))


def _guess_image_mime(path: Path, output_format: str) -> str:
    suffix = (path.suffix.lstrip(".") or output_format or "png").lower()
    if suffix in {"jpg", "jpeg"}:
        return "image/jpeg"
    if suffix == "webp":
        return "image/webp"
    return "image/png"


def _extract_signed_url(payload: Any) -> Optional[str]:
    if isinstance(payload, str) and payload:
        return payload
    if isinstance(payload, dict):
        for key in ("signedURL", "signedUrl", "signed_url"):
            value = payload.get(key)
            if isinstance(value, str) and value:
                return value
        data = payload.get("data")
        if isinstance(data, dict):
            for key in ("signedURL", "signedUrl", "signed_url"):
                value = data.get(key)
                if isinstance(value, str) and value:
                    return value
    return None


def _normalize_supabase_signed_url(supabase_url: str, signed_url: str) -> str:
    if re.match(r"^https?://", signed_url, re.IGNORECASE):
        return signed_url
    if signed_url.startswith("/storage/v1/"):
        return urljoin(f"{supabase_url}/", signed_url)
    if signed_url.startswith("/object/"):
        return f"{supabase_url}/storage/v1{signed_url}"
    if signed_url.startswith("object/"):
        return f"{supabase_url}/storage/v1/{signed_url}"
    return urljoin(f"{supabase_url}/storage/v1/", signed_url.lstrip("/"))


def _current_hermes_session_id() -> str:
    try:
        from gateway.session_context import get_session_env

        return get_session_env("HERMES_SESSION_ID", "") or _env("HERMES_SESSION_ID")
    except Exception:
        return _env("HERMES_SESSION_ID")


def _upload_local_image_to_supabase(path: Path, *, output_format: str) -> Optional[Dict[str, str]]:
    supabase_url = _env("SUPABASE_URL")
    service_role_key = _env("SUPABASE_SERVICE_ROLE_KEY")
    if not supabase_url or not service_role_key:
        return None

    import requests

    supabase_url = supabase_url.rstrip("/")
    bucket = _env("SUPABASE_OUTPUTS_BUCKET", "image-gen-outputs")
    prefix = _env("SUPABASE_GENERATED_IMAGES_PREFIX", _SUPABASE_IMAGE_PREFIX).strip("/") or _SUPABASE_IMAGE_PREFIX
    expires_in = int(_env("SUPABASE_SIGNED_URL_EXPIRES_SECONDS", "604800") or "604800")
    max_attempts = max(1, int(_env("SUPABASE_UPLOAD_MAX_ATTEMPTS", "3") or "3"))
    backoff = max(0.0, float(_env("SUPABASE_UPLOAD_BACKOFF_SECONDS", "1") or "1"))

    session_segment = _sanitize_storage_segment(_current_hermes_session_id())
    fallback_suffix = f".{output_format or 'png'}"
    filename = f"{_sanitize_storage_segment(path.stem, 'image')}{path.suffix or fallback_suffix}"
    storage_path = f"{prefix}/{session_segment}/{filename}"
    encoded_path = _encode_storage_path(storage_path)
    headers = {
        "apikey": service_role_key,
        "Authorization": f"Bearer {service_role_key}",
    }
    upload_headers = {
        **headers,
        "Content-Type": _guess_image_mime(path, output_format),
        "x-upsert": "true",
    }

    uploaded = False
    for attempt in range(1, max_attempts + 1):
        try:
            with path.open("rb") as file_obj:
                response = requests.post(
                    f"{supabase_url}/storage/v1/object/{quote(bucket, safe='')}/{encoded_path}",
                    headers=upload_headers,
                    data=file_obj,
                    timeout=90,
                )
            response.raise_for_status()
            uploaded = True
            break
        except Exception as exc:  # noqa: BLE001 - upload is best effort
            if attempt >= max_attempts:
                raise
            time.sleep(backoff * attempt)
    if not uploaded:
        raise RuntimeError("Supabase upload did not complete")

    sign_response = requests.post(
        f"{supabase_url}/storage/v1/object/sign/{quote(bucket, safe='')}/{encoded_path}",
        headers={**headers, "Content-Type": "application/json"},
        json={"expiresIn": expires_in},
        timeout=30,
    )
    sign_response.raise_for_status()
    signed_url = _extract_signed_url(sign_response.json())
    if not signed_url:
        raise RuntimeError("Supabase did not return a signed URL for generated image")

    normalized_signed_url = _normalize_supabase_signed_url(supabase_url, signed_url)
    expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)
    return {
        "image_url": normalized_signed_url,
        "download_url": normalized_signed_url,
        "storage_path": storage_path,
        "storage_bucket": bucket,
        "signed_url_expires_at": expires_at.isoformat().replace("+00:00", "Z"),
    }


def _delete_local_cache_after_upload(path: Path) -> bool:
    if not _env_bool("HERMES_IMAGE_SUPABASE_DELETE_LOCAL_CACHE", True):
        return False
    try:
        path.unlink(missing_ok=True)
        return True
    except OSError as exc:
        logger.debug("Could not delete uploaded local image cache %s: %s", path, exc)
        return False


def _publish_saved_image(path: Path, *, output_format: str) -> Tuple[str, Dict[str, Any]]:
    extra: Dict[str, Any] = {}
    image_ref = str(path)
    try:
        uploaded = _upload_local_image_to_supabase(path, output_format=output_format)
    except Exception as exc:  # noqa: BLE001 - keep image generation successful
        logger.warning("Could not upload generated image to Supabase Storage: %s", exc)
        extra["supabase_upload_error"] = str(exc)
        return image_ref, extra

    if not uploaded:
        return image_ref, extra

    image_ref = uploaded["image_url"]
    extra.update(uploaded)
    extra["local_cache_removed"] = _delete_local_cache_after_upload(path)
    return image_ref, extra


def _clean_option(value: Any, allowed: set[str]) -> Optional[str]:
    if not isinstance(value, str):
        return None
    candidate = value.strip().lower()
    return candidate if candidate in allowed else None


def _resolve_quality(override: Any) -> Tuple[str, str]:
    quality = _clean_option(override, _QUALITY_VALUES)
    if quality:
        return f"{API_MODEL}-{quality}", quality

    tier_id, meta = _resolve_model()
    return tier_id, meta["quality"]


def _resolve_size(override: Any, aspect: str) -> str:
    size = _clean_option(override, _EXPLICIT_SIZES)
    if size:
        return size
    return _SIZES.get(aspect, _SIZES["square"])


def _resolve_output_format(override: Any) -> Tuple[str, bool]:
    output_format = _clean_option(override, _OUTPUT_FORMATS)
    if output_format:
        return output_format, True
    return "png", False


def _load_openai_config() -> Dict[str, Any]:
    """Read ``image_gen`` from config.yaml (returns {} on any failure)."""
    try:
        from hermes_cli.config import load_config

        cfg = load_config()
        section = cfg.get("image_gen") if isinstance(cfg, dict) else None
        return section if isinstance(section, dict) else {}
    except Exception as exc:
        logger.debug("Could not load image_gen config: %s", exc)
        return {}


def _resolve_model() -> Tuple[str, Dict[str, Any]]:
    """Decide which tier to use and return ``(model_id, meta)``."""
    env_override = os.environ.get("OPENAI_IMAGE_MODEL")
    if env_override and env_override in _MODELS:
        return env_override, _MODELS[env_override]

    cfg = _load_openai_config()
    openai_cfg = cfg.get("openai") if isinstance(cfg.get("openai"), dict) else {}
    candidate: Optional[str] = None
    if isinstance(openai_cfg, dict):
        value = openai_cfg.get("model")
        if isinstance(value, str) and value in _MODELS:
            candidate = value
    if candidate is None:
        top = cfg.get("model")
        if isinstance(top, str) and top in _MODELS:
            candidate = top

    if candidate is not None:
        return candidate, _MODELS[candidate]

    return DEFAULT_MODEL, _MODELS[DEFAULT_MODEL]


# ---------------------------------------------------------------------------
# Provider
# ---------------------------------------------------------------------------


class OpenAIImageGenProvider(ImageGenProvider):
    """OpenAI ``images.generate`` backend — gpt-image-2 at low/medium/high."""

    @property
    def name(self) -> str:
        return "openai"

    @property
    def display_name(self) -> str:
        return "OpenAI"

    def is_available(self) -> bool:
        if not os.environ.get("OPENAI_API_KEY"):
            return False
        try:
            import openai  # noqa: F401
        except ImportError:
            return False
        return True

    def list_models(self) -> List[Dict[str, Any]]:
        return [
            {
                "id": model_id,
                "display": meta["display"],
                "speed": meta["speed"],
                "strengths": meta["strengths"],
                "price": "varies",
            }
            for model_id, meta in _MODELS.items()
        ]

    def default_model(self) -> Optional[str]:
        return DEFAULT_MODEL

    def get_setup_schema(self) -> Dict[str, Any]:
        return {
            "name": "OpenAI",
            "badge": "paid",
            "tag": "gpt-image-2 at low/medium/high quality tiers",
            "env_vars": [
                {
                    "key": "OPENAI_API_KEY",
                    "prompt": "OpenAI API key",
                    "url": "https://platform.openai.com/api-keys",
                },
            ],
        }

    def generate(
        self,
        prompt: str,
        aspect_ratio: str = DEFAULT_ASPECT_RATIO,
        **kwargs: Any,
    ) -> Dict[str, Any]:
        prompt = (prompt or "").strip()
        aspect = resolve_aspect_ratio(aspect_ratio)

        if not prompt:
            return error_response(
                error="Prompt is required and must be a non-empty string",
                error_type="invalid_argument",
                provider="openai",
                aspect_ratio=aspect,
            )

        if not os.environ.get("OPENAI_API_KEY"):
            return error_response(
                error=(
                    "OPENAI_API_KEY not set. Run `hermes tools` → Image "
                    "Generation → OpenAI to configure, or `hermes setup` "
                    "to add the key."
                ),
                error_type="auth_required",
                provider="openai",
                aspect_ratio=aspect,
            )

        try:
            import openai
        except ImportError:
            return error_response(
                error="openai Python package not installed (pip install openai)",
                error_type="missing_dependency",
                provider="openai",
                aspect_ratio=aspect,
            )

        tier_id, quality = _resolve_quality(kwargs.get("quality"))
        size = _resolve_size(kwargs.get("size"), aspect)
        output_format, explicit_output_format = _resolve_output_format(kwargs.get("output_format"))

        # gpt-image-2 returns b64_json unconditionally and REJECTS
        # ``response_format`` as an unknown parameter. Don't send it.
        payload: Dict[str, Any] = {
            "model": API_MODEL,
            "prompt": prompt,
            "size": size,
            "n": 1,
            "quality": quality,
        }
        if explicit_output_format:
            payload["output_format"] = output_format

        try:
            client = openai.OpenAI()
            response = client.images.generate(**payload)
        except Exception as exc:
            logger.debug("OpenAI image generation failed", exc_info=True)
            return error_response(
                error=f"OpenAI image generation failed: {exc}",
                error_type="api_error",
                provider="openai",
                model=tier_id,
                prompt=prompt,
                aspect_ratio=aspect,
            )

        data = getattr(response, "data", None) or []
        if not data:
            return error_response(
                error="OpenAI returned no image data",
                error_type="empty_response",
                provider="openai",
                model=tier_id,
                prompt=prompt,
                aspect_ratio=aspect,
            )

        first = data[0]
        b64 = getattr(first, "b64_json", None)
        url = getattr(first, "url", None)
        revised_prompt = getattr(first, "revised_prompt", None)
        saved_path: Optional[Path] = None

        if b64:
            try:
                saved_path = save_b64_image(
                    b64,
                    prefix=f"openai_{tier_id}",
                    extension=output_format,
                )
            except Exception as exc:
                return error_response(
                    error=f"Could not save image to cache: {exc}",
                    error_type="io_error",
                    provider="openai",
                    model=tier_id,
                    prompt=prompt,
                    aspect_ratio=aspect,
                )
            image_ref = str(saved_path)
        elif url:
            # Defensive — gpt-image-2 returns b64 today, but OpenAI's API
            # has previously returned URLs.  Cache the bytes locally so the
            # gateway never tries to fetch an ephemeral / signed URL after
            # it expires — same rationale as the xAI provider (#26942).
            try:
                saved_path = save_url_image(url, prefix=f"openai_{tier_id}")
            except Exception as exc:
                logger.warning(
                    "OpenAI image URL %s could not be cached (%s); falling back to bare URL.",
                    url,
                    exc,
                )
                image_ref = url
            else:
                image_ref = str(saved_path)
        else:
            return error_response(
                error="OpenAI response contained neither b64_json nor URL",
                error_type="empty_response",
                provider="openai",
                model=tier_id,
                prompt=prompt,
                aspect_ratio=aspect,
            )

        extra: Dict[str, Any] = {
            "size": size,
            "quality": quality,
            "output_format": output_format,
        }
        if revised_prompt:
            extra["revised_prompt"] = revised_prompt

        if saved_path is not None:
            image_ref, publish_extra = _publish_saved_image(saved_path, output_format=output_format)
            extra.update(publish_extra)

        return success_response(
            image=image_ref,
            model=tier_id,
            prompt=prompt,
            aspect_ratio=aspect,
            provider="openai",
            extra=extra,
        )


# ---------------------------------------------------------------------------
# Plugin entry point
# ---------------------------------------------------------------------------


def register(ctx) -> None:
    """Plugin entry point — wire ``OpenAIImageGenProvider`` into the registry."""
    ctx.register_image_gen_provider(OpenAIImageGenProvider())
