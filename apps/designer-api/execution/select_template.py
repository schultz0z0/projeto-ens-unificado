"""
execution/select_template.py
Layer 3 — Seleção determinística do template base na biblioteca.

Responsabilidade: Dado um canal e um KV (key-visual), retorna o Path
exato do arquivo PNG base em templates_library/{canal}/{kv}/.
"""

import os
from pathlib import Path


# Diretório raiz da biblioteca de templates (relativo ao main.py)
TEMPLATES_ROOT = Path(__file__).parent.parent / "templates_library"


class TemplateNotFoundError(FileNotFoundError):
    """Levantado quando nenhum template PNG é encontrado para canal/kv."""
    pass


def select_template(canal: str, kv: str) -> Path:
    """
    Localiza o arquivo PNG base para o canal e kv informados.

    A busca é determinística: percorre templates_library/{canal}/{kv}/
    e retorna o PRIMEIRO arquivo .png encontrado (ordem alfabética).
    Isso garante comportamento consistente quando há exatamente um arquivo base.

    Args:
        canal: Nome do canal (ex: "01_feed_instagram").
        kv:    Nome do key-visual (ex: "graduacao", "pos").

    Returns:
        Path absoluto para o arquivo PNG base.

    Raises:
        TemplateNotFoundError: Se a pasta não existir ou não houver .png.
    """
    template_dir = TEMPLATES_ROOT / canal / kv

    if not template_dir.exists():
        raise TemplateNotFoundError(
            f"Diretório de template não encontrado: {template_dir}\n"
            f"Verifique se canal='{canal}' e kv='{kv}' estão corretos "
            f"e se a pasta existe em templates_library/."
        )

    # Busca por qualquer imagem base na pasta (png/jpg/jpeg)
    png_files = sorted(template_dir.glob("*.png")) + sorted(template_dir.glob("*.PNG"))
    jpg_files = sorted(template_dir.glob("*.jpg")) + sorted(template_dir.glob("*.JPG"))
    jpeg_files = sorted(template_dir.glob("*.jpeg")) + sorted(template_dir.glob("*.JPEG"))
    image_files = png_files + jpg_files + jpeg_files

    if not image_files:
        raise TemplateNotFoundError(
            f"Nenhum arquivo de imagem encontrado em: {template_dir}\n"
            f"Adicione o template base nessa pasta seguindo o padrão "
            f"'base_{{kv}}_{{canal}}_padrao.png' ou .jpg/.jpeg."
        )

    selected = image_files[0]
    print(f"[select_template] ✓ Template selecionado: {selected.name}")
    return selected


def list_templates() -> dict[str, dict[str, list[str]]]:
    templates: dict[str, dict[str, list[str]]] = {}
    if not TEMPLATES_ROOT.exists():
        return templates
    for canal_dir in sorted(TEMPLATES_ROOT.iterdir()):
        if not canal_dir.is_dir():
            continue
        kv_map: dict[str, list[str]] = {}
        for kv_dir in sorted(canal_dir.iterdir()):
            if not kv_dir.is_dir():
                continue
            png_files = sorted(kv_dir.glob("*.png")) + sorted(kv_dir.glob("*.PNG"))
            jpg_files = sorted(kv_dir.glob("*.jpg")) + sorted(kv_dir.glob("*.JPG"))
            jpeg_files = sorted(kv_dir.glob("*.jpeg")) + sorted(kv_dir.glob("*.JPEG"))
            image_files = png_files + jpg_files + jpeg_files
            if not image_files:
                continue
            kv_map[kv_dir.name] = [p.name for p in image_files]
        if kv_map:
            templates[canal_dir.name] = kv_map
    return templates


if __name__ == "__main__":
    # Teste rápido de validação local (não consome créditos)
    try:
        path = select_template("01_feed_instagram", "graduacao")
        print(f"Template encontrado: {path}")
    except TemplateNotFoundError as e:
        print(f"ERRO: {e}")
