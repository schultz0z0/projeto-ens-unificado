# Plano Refinado: Melhoria de Qualidade no Resize Final

## Entendimento do Fluxo Atual

### Pipeline de Geração (process_job)

```
Template PNG (resolução original do canal)
         │
         ▼
   [FASE 1 — Step 1: Textos/Boxes]
   _edit_image_step_with_reference()
   → Gemini 3 Pro Image gera em 4K (IMAGE_SIZE=4K)
         │
         ▼
   [FASE 2 — Step 2: Persona/Fundo]
   _edit_image_step_with_reference()
   → Gemini 3 Pro Image gera em 4K
         │
         ▼
   [FASE FINAL — _postprocess_final_resolution()]
   → Lê dimensões do template original
   → Faz LANCZOS resize de ~3840x2160 → ex: 1080x1080
   → Aplica UnsharpMask (radius=0.6, percent=120, threshold=1)
   → Salva como PNG compress_level=1
         │
         ▼
   outputs/{canal}_{kv}_{timestamp}.png  ← ENTREGA FINAL
   + .editable.png                       ← base para ajustes manuais
```

### Fluxo de Ajuste Manual (process_adjustment)

```
.editable.png (4K)
    │
    ▼
_edit_image_step_raw()
→ Gemini gera em 4K (image_size="4K" hardcoded)
    │
    ▼
_postprocess_final_resolution()  ← MESMA FUNÇÃO
→ resolve dimensão alvo (lê o delivery original)
→ LANCZOS resize + UnsharpMask
    │
    ▼
outputs/adj_{timestamp}_{nome}.png
```

---

## Fatores de Redução Reais por Template

O modelo Gemini gera em **4K** com aspect ratio proporcional ao template. Estimando a resolução 4K em cada canal:

| Canal | Target | Estimativa 4K gerado | Ratio máx | Classificação |
|---|---|---|---|---|
| `01_feed_instagram` | 1080×1350 | ~3200×4000 (4:5) | **3.0×** | Alto |
| `02_story_instagram` | 1080×1922 | ~2160×3840 (9:16) | **2.0×** | Moderado |
| `03_banner_interno_desktop` | 1440×605 | ~3840×1615 (21:9) | **2.7×** | Alto |
| `04_banner_interno_mobile` | 415×500 | ~3200×3840 (4:5) | **7.7×** | ⚠️ Crítico |
| `05_whatsapp` | 1350×1350 | ~3840×3840 (1:1) | **2.84×** | Alto |
| `08_topo_email` | 600×400 | ~3840×2560 (3:2) | **6.4×** | ⚠️ Crítico |

> **Banner mobile (415px) e Topo e-mail (600px) são os piores casos**: a imagem vai de ~3200–3840px para menos de 600px em uma única passagem. Nesses canais o efeito pixelado é inevitável com a abordagem atual.

---

## Diagnóstico: Causa Raiz da Perda de Qualidade

### Parâmetros atuais (`main.py` linha 179–181)
```python
self.delivery_sharpen_radius   = float(os.getenv("DELIVERY_SHARPEN_RADIUS",  "0.6"))
self.delivery_sharpen_percent  = int(os.getenv("DELIVERY_SHARPEN_PERCENT",   "120"))
self.delivery_sharpen_threshold = int(os.getenv("DELIVERY_SHARPEN_THRESHOLD", "1"))
```

### Função `_postprocess_final_resolution` (linhas 1314–1361)
```python
resample_filter = Image.Resampling.LANCZOS  # downsampling

# reducing_gap=3.0 → apenas 1 "pass" intermediate (Pillow padrão)
resized = image.resize((target_w, target_h), resample=LANCZOS, reducing_gap=3.0)

# UnsharpMask pós-resize
resized = resized.filter(ImageFilter.UnsharpMask(
    radius=0.6,      # ← muito suave para grandes reduções
    percent=120,     # ← moderado
    threshold=1,
))

# PNG salvo com compress_level=1 (baixa compressão = preserva qualidade)
```

### Por que há perda de qualidade?

| Fator | Problema |
|---|---|
| **Fator de redução extremo** | 4K (~3840px) → 1080px = razão de **3.55:1**. Para whatsapp (600px) chega a **6.4:1**. Esse nível de downsampling é agressivo e o LANCZOS com uma única passagem introduz artefatos de aliasing em detalhes finos. |
| **`reducing_gap=3.0` insuficiente** | O parâmetro `reducing_gap` do Pillow ajuda mas não elimina o problema. Para reduções >2:1, o ideal são **múltiplos steps intermediários** (downsample progressivo). |
| **UnsharpMask muito suave** | `radius=0.6` com `percent=120` gera sharpen imperceptível quando há grande redução. Precisa de `radius` maior (1.0–2.0) e `percent` mais agressivo (150–200) para compensar a suavidade do LANCZOS em grandes reduções. |
| **Ausência de pré-filtro** | Antes do LANCZOS, aplicar um suave `GaussianBlur` ou `BoxBlur` pode reduzir artefatos de moiré e ringing que aparecem em downsampling extremo. |
| **Dimensões dos templates são pequenas** | Exemplos estimados: feed 1080×1080, story 1080×1920, banner desktop ~1440px wide. A relação 4K→template pode superar 3:1 facilmente. |

> [!IMPORTANT]
> A regressão provavelmente foi causada por uma **mudança nos valores de `DELIVERY_SHARPEN_RADIUS` e `DELIVERY_SHARPEN_PERCENT`** (via `.env` ou código), ou pela introdução do `reducing_gap=3.0` que, contra-intuitivamente, pode produzir resultados piores do que um downsample multi-step manual para grandes reduções.

---

## Estratégias de Melhoria (não mutuamente exclusivas)

### Estratégia A — Downsample Multi-Step (Mais Impactante)

Em vez de reduzir de 4K direto ao tamanho final, fazer **passos intermediários em 50%** até chegar perto do target, e no último passo usar LANCZOS.

```
3840×2160 → 1920×1080 → 1080×1080 (ou target)
```

Cada passo de 50% é ótimo para o LANCZOS: elimina aliasing e preserva nitidez de bordas e texto.

**Por que funciona**: cada redução de 50% é matematicamente exata para o filtro. O LANCZOS tem o melhor desempenho nessa faixa.

### Estratégia B — Sharpening Adaptativo Calibrado pelas Dimensões Reais

Com os fatores reais calculados, os parâmetros são calibrados assim:

| Razão de Redução | Canais afetados | radius | percent | threshold |
|---|---|---|---|---|
| < 2× | `02_story_instagram` | 0.6 | 120 | 1 |
| 2×–3× | `01_feed_instagram`, `03_banner_desktop`, `05_whatsapp` | 1.0 | 155 | 1 |
| 3×–5× | (margem de segurança) | 1.5 | 175 | 0 |
| > 5× | `04_banner_mobile`, `08_topo_email` | 2.0 | 200 | 0 |

Atualmente usa valores fixos (radius=0.6, percent=120) independentemente da razão — completamente insuficiente para banner mobile (7.7×) e topo email (6.4×).

### Estratégia C — Pré-filtro Anti-Aliasing (BoxBlur antes do resize)

Para grandes fatores de redução, aplicar um `BoxBlur` ou `GaussianBlur` leve antes do resize previne artefatos de moiré.

```python
pre_blur_radius = max(0, (source_w / target_w) * 0.25)
image = image.filter(ImageFilter.GaussianBlur(radius=pre_blur_radius))
```

### Estratégia D — Verificar se reducing_gap está atrapalhando

O parâmetro `reducing_gap` no Pillow ativa um "pre-downsampling" interno mas com qualidade inferior. Para ratio alto, pode ser melhor usar Estratégia A (multi-step manual) e remover `reducing_gap`.

---

## Proposta de Implementação

### Mudança principal: `_postprocess_final_resolution`

Substituir a lógica de resize simples por **downsample progressivo com sharpening adaptativo**:

```python
def _postprocess_final_resolution(self, source_path, target_size, output_path):
    image = Image.open(source_path)
    source_w, source_h = self._safe_image_size(image)
    target_w, target_h = target_size

    # Skip se mesmas dimensões
    if (source_w, source_h) == (target_w, target_h):
        shutil.copy(source_path, output_path)
        return output_path

    use_downsampling = target_w <= source_w and target_h <= source_h

    if use_downsampling:
        # === MULTI-STEP DOWNSAMPLE ===
        reduction_ratio = max(source_w / target_w, source_h / target_h)
        current = image

        # Passo a passo: reduzir ~50% por vez até próximo do target
        while True:
            curr_w, curr_h = current.size
            next_w = max(target_w, curr_w // 2)
            next_h = max(target_h, curr_h // 2)

            if (next_w, next_h) == (target_w, target_h) or \
               (curr_w <= target_w * 1.5 and curr_h <= target_h * 1.5):
                # Passo final: LANCZOS para o tamanho exato
                current = current.resize((target_w, target_h),
                                         resample=Image.Resampling.LANCZOS)
                break
            
            # Passo intermediário: LANCZOS 50%
            current = current.resize((next_w, next_h),
                                     resample=Image.Resampling.LANCZOS)

        # === SHARPENING ADAPTATIVO ===
        if reduction_ratio < 1.5:
            radius, percent, threshold = 0.4, 80, 3
        elif reduction_ratio < 2.0:
            radius, percent, threshold = 0.6, 120, 1
        elif reduction_ratio < 3.0:
            radius, percent, threshold = 1.0, 150, 1
        else:
            radius, percent, threshold = 1.5, 180, 0

        # Override via env se definido
        radius    = float(os.getenv("DELIVERY_SHARPEN_RADIUS",   str(radius)))
        percent   = int(os.getenv("DELIVERY_SHARPEN_PERCENT",    str(percent)))
        threshold = int(os.getenv("DELIVERY_SHARPEN_THRESHOLD",  str(threshold)))

        resized = current.filter(ImageFilter.UnsharpMask(
            radius=radius,
            percent=percent,
            threshold=threshold,
        ))
    else:
        # Upscale: BICUBIC simples (cenário raro)
        resized = image.resize((target_w, target_h),
                               resample=Image.Resampling.BICUBIC)

    # Salvar com máxima qualidade
    save_kwargs = {}
    if output_path.suffix.lower() == ".png":
        save_kwargs["compress_level"] = 1
    elif output_path.suffix.lower() in {".jpg", ".jpeg"}:
        save_kwargs.update({"quality": 100, "subsampling": 0})

    resized.save(output_path, **save_kwargs)
    return output_path
```

### Variáveis de ambiente novas (`.env.example`)

```env
# Sharpening adaptativo — deixar vazio para usar valores automáticos por razão de redução
DELIVERY_SHARPEN_RADIUS=
DELIVERY_SHARPEN_PERCENT=
DELIVERY_SHARPEN_THRESHOLD=
```

---

## Arquivos Afetados

### [MODIFY] [main.py](file:///c:/Users/raphaeloliveira/Desktop/Projetos%20Saas/projeto-ens-unificado/apps/designer-api/main.py)

#### `_postprocess_final_resolution` (linhas 1314–1361)
- Substituir o `image.resize()` simples + UnsharpMask fixo por:
  - Loop de multi-step LANCZOS até o target
  - Sharpening adaptativo com fallback para env vars

#### `__init__` (linha 179–181)
- Manter `self.delivery_sharpen_*` mas tornar o valor padrão `None` ou `""` para sinalizar "usar adaptativo"

### [MODIFY] [.env.example](file:///c:/Users/raphaeloliveira/Desktop/Projetos%20Saas/projeto-ens-unificado/apps/designer-api/.env.example)
- Documentar que os valores de sharpen agora são adaptativos por padrão

---

## Verificação

### Antes vs Depois

1. Gerar imagem em canal `01_feed_instagram` / `02_story_instagram` (maiores fatores de redução)
2. Comparar visualmente: bordas, texto das boxes, nitidez geral
3. Checar via `debug_output.png` vs `debug_output_4k.png` existentes no projeto

### Testes Automatizados

- `tests/test_integration_mock.py` — verificar que `_postprocess_final_resolution` produz arquivo com dimensões corretas
- Adicionar teste de nitidez simples: desvio padrão de `LaplacianFilter` deve ser maior que threshold após resize

---

## Open Questions

> [!IMPORTANT]
> **O `.env` foi alterado recentemente?**
> Antes as imagens estavam boas e agora pioraram. A causa mais provável é uma mudança nos valores de `DELIVERY_SHARPEN_RADIUS`/`DELIVERY_SHARPEN_PERCENT` no `.env`, ou a introdução do `reducing_gap=3.0`. Sabe dizer quando começou a perceber a piora?

> [!NOTE]
> **Dimensões dos templates**
> Não consegui medir as dimensões reais dos PNGs dos templates sem o venv disponível localmente. Se você souber as dimensões exatas (especialmente os menores templates como `08_topo_email` e `07_banner_home_mobile`), isso ajuda a calibrar os thresholds do sharpening adaptativo.
