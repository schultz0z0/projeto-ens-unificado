"""
create_placeholder_templates.py
Script auxiliar para criar PNGs de placeholder na templates_library/.
Executar UMA VEZ após configurar o projeto, antes de adicionar templates reais.
Substitua os PNGs gerados pelos templates oficiais da ENS.
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

# Estrutura de templates conforme PRD
TEMPLATES = [
    # (canal,              kv,          width, height)
    ("01_feed_instagram",  "graduacao", 1080, 1350),
    ("01_feed_instagram",  "pos",       1080, 1350),
    ("02_story_instagram", "graduacao", 1080, 1920),
    ("02_story_instagram", "pos",       1080, 1920),
    ("03_banner_interno",  "graduacao", 1920,  600),
    ("03_banner_interno",  "pos",       1920,  600),
]

BASE_DIR = Path(__file__).parent / "templates_library"


def create_placeholder(canal: str, kv: str, width: int, height: int) -> Path:
    """Cria um PNG placeholder com fundo laranja ENS e texto indicativo das 6 zonas."""
    out_dir = BASE_DIR / canal / kv
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"base_{kv}_{canal.split('_')[0]}{canal.split('_')[1]}_padrao.png"

    # Cores ENS
    bg_color = (229, 81, 27)      # Laranja ENS
    text_color = (255, 255, 255)  # Branco
    box_color = (0, 0, 0, 100)    # Semi-transparente

    img = Image.new("RGB", (width, height), bg_color)
    draw = ImageDraw.Draw(img, "RGBA")

    # Zonas das 6 chaves (proporcionais)
    zones = [
        ("ETIQUETA",  (width * 0.05, height * 0.05,  width * 0.6,  height * 0.12)),
        ("TITULO",    (width * 0.05, height * 0.20,  width * 0.95, height * 0.45)),
        ("FRASE",     (width * 0.05, height * 0.46,  width * 0.95, height * 0.58)),
        ("BOX 1",     (width * 0.05, height * 0.82,  width * 0.45, height * 0.95)),
        ("BOX 2",     (width * 0.55, height * 0.82,  width * 0.95, height * 0.95)),
        ("PERSONA\n(Fundo)", (width * 0.55, height * 0.05, width * 0.95, height * 0.75)),
    ]

    for label, (x0, y0, x1, y1) in zones:
        draw.rectangle([x0, y0, x1, y1], fill=(0, 0, 0, 80), outline=text_color, width=3)
        cx = (x0 + x1) / 2
        cy = (y0 + y1) / 2
        draw.text((cx, cy), label, fill=text_color, anchor="mm")

    # Título do placeholder
    draw.text(
        (width / 2, height * 0.015),
        f"PLACEHOLDER — {canal} / {kv} ({width}×{height})",
        fill=(255, 255, 0),
        anchor="mm",
    )

    img.save(str(out_path))
    print(f"✓ Criado: {out_path.relative_to(BASE_DIR.parent)}")
    return out_path


if __name__ == "__main__":
    print("Criando placeholders de template (SUBSTITUIR pelos templates reais da ENS)\n")
    for canal, kv, w, h in TEMPLATES:
        create_placeholder(canal, kv, w, h)
    print("\nDone! Adicione os templates PNG reais sobre estes placeholders.")
