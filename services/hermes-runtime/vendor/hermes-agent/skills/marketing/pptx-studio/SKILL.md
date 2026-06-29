---
name: pptx-studio
description: 'Generate premium visual PPTX 16:9 (1280x720) presentations for ENS marketing. Engine: pptxgenjs puro (recomendado) ou dom-to-pptx. Use kv.modality (mba=#005563, graduacao=#F57222). Default theme CLARO. SEPARATE from pdf-studio (A4/A5). Hardcoded preferences: Graduacao sempre laranja (nunca teal de MBA), fundo creme #F4F1E1 slides 2-N, NUNCA emojis (SVG/lucide via PNG), logo ENS via PNG transparente, fotos laterais croppadas (nunca achatar). v3.4: hybrid pipeline adm-zip DEPRECATED.'
version: 3.5.0
author: Raphael (ENS Marketing) + Hermes
license: MIT
triggers:
  - "pptx"
  - "slide"
  - "apresentacao"
  - "16x9"
  - "presentation"
  - "deck"
  - "slides de marketing"
  - "montar pptx"
  - "gerar slides"
  - "apresentacao institucional"
metadata:
  hermes:
    tags: [pptx, slide, 16x9, presentation, visual, marketing, ens, premium, html-css, dom-to-pptx, pptxgenjs, no-templates, page-by-page, primitives, modality-colors, light-theme-default, separate-from-pdf-studio]
    category: marketing
    related_skills:
      - impeccable-design-polish
      - frontend-design
      - taste-skill
      - theme-factory
      - marketing-psychology
      - paywall-upgrade-cro
      - canvas-design
      - nexus-token-map
      - claude-design
    homepage: hermes-ens
    requires_runtime: [node, npm, chromium]
    install:
      - "npm ci --omit=dev"
      - "node scripts/patch-dom-to-pptx.js"
---

# PPTX Studio v3.5

> Skill de **geração de apresentações PPTX 16:9 (1280x720)** para marketing ENS. Engine: pptxgenjs puro (recomendado) ou dom-to-pptx. **NÃO** converter HTML A4 → 16:9 forçando dimensões (gera layout espremido).

> **CRÍTICO APÓS `npm install`**: rode `node scripts/patch-dom-to-pptx.js` para aplicar fix do bug SVG className. Sem isso, HTML com SVG inline falha com `"node.className.split is not a function"`.

## Pré-requisitos de runtime

Esta skill precisa de:

| Dependência | Versão | Instalado no Dockerfile? |
|--------------|--------|--------------------------|
| Node.js | 20+ | ✅ (`apt-get install nodejs npm` no Dockerfile) |
| Chromium | latest | ✅ (`apt-get install chromium`) |
| dom-to-pptx | ^2.0.1 | ❌ (precisa `npm install`) |
| adm-zip | ^0.5.17 | ❌ (precisa `npm install`) |
| playwright (Node) | ^1.61.1 | ❌ (precisa `npm install`) |

**O Dockerfile do hermes-runtime** já foi atualizado pra rodar `npm ci` + patch automaticamente durante o build. Em dev local, rode manualmente:

```bash
cd /opt/data/skills/marketing/pptx-studio  # ou onde estiver
npm ci --omit=dev
node scripts/patch-dom-to-pptx.js
```

## Filosofia

- **Cada slide é arquivo HTML isolado**, escrito do zero com composição 16:9 (font-sizes 30-50% maiores que A4, layouts horizontais)
- **NÃO há templates, NÃO há layout dispatch** — biblioteca de primitives (`.card-flat`, `.kpi-number`, `.hero-fullbleed`) é o vocabulário
- **Default theme CLARO** (fundo creme `#F4F1E1` slides 2-N), mas cada slide pode customizar via CSS
- **Modality colors** ditam paleta primária (mba=#005563 teal escuro, graduacao=#F57222 laranja, chcs=#009688 teal médio, etc — ver `engine/theme.js`)

## Engines disponíveis

| Engine | Quando usar | Script |
|--------|-------------|--------|
| **pptxgenjs puro** (RECOMENDADO v3.4+) | Qualquer projeto. Capa+encerramento com hero full-bleed, ou 100% diagramas/KPis. | `engine/compose-pptxgenjs-full.js` |
| dom-to-pptx puro | Projetos SEM capa/encerramento com hero (slides 100% texto+KPI+cards). | `engine/compose-pptx-v2.js` |
| ~~Hybrid adm-zip merge~~ | ❌ DEPRECADO v3.4 — merge corrompia PPTX (slide2.xml sumia). | ~~`engine/merge-pptx.js`~~ |

## Estrutura

```
pptx-studio/
├── SKILL.md
├── package.json              # deps: dom-to-pptx, adm-zip, playwright
├── primitives/
│   ├── styles.css            # CSS input
│   └── dist/styles.css       # compilado (gerado por build-css.js)
├── engine/
│   ├── theme.js              # modality → CSS variables
│   ├── build-css.js          # minifica input.css → dist/styles.css
│   ├── compose-pptx-v2.js    # pipeline: HTML → dom-to-pptx → PPTX
│   ├── compose-pptxgenjs-full.js  # [RECOMENDADO] pipeline monolítico pptxgenjs
│   ├── validate-pptx.js      # wrapper simples
│   └── validate-pptx-deep.js # valida estrutura (16:9, ZIP, OOXML, imagens)
├── pages/
│   └── <projeto>/            # 1 projeto = 1 apresentação
│       ├── BRIEF.md          # brief expandido ANTES de HTMLs (lição 14)
│       ├── p1_capa.html
│       ├── p2_abertura.html
│       ├── ...
│       └── assets/
├── assets/                   # logo ENS, Outfit font, imagens globais
├── scripts/
│   ├── patch-dom-to-pptx.js  # CRÍTICO: aplica fix SVG após npm install
│   └── check-pptx-integrity.js
└── references/
    ├── lessons-learned.md    # 23 lições críticas (pitfalls)
    ├── troubleshooting.md
    ├── hybrid-pipeline.md    # [v3.3] workflow híbrido DEPRECADO
    ├── unsplash-integration.md
    └── CROSS-REFERENCES.md   # link com arsenal frontend
```

## Comandos principais

```bash
# 1. Compilar CSS (se primitives/styles.css mudar)
npm run build:css

# 2. Preview local via Playwright (NÃO use LibreOffice — ver lição 20)
node -e "const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1280,height:720}});await p.goto('file://'+process.cwd()+'/pages/<proj>/p1.html',{waitUntil:'networkidle'});await p.screenshot({path:'/tmp/p1.png'});await b.close()})()"

# 3. Pipeline RECOMENDADO (pptxgenjs puro):
node engine/compose-pptxgenjs-full.js <out-dir> <name>

# 4. Validar estrutura:
node engine/validate-pptx.js <arquivo.pptx>
```

## Hierarquia tipográfica (escala 16:9)

| Tag | Tamanho (16:9) | Comparação A4 |
|------|----------------|---------------|
| `.heading-display` | **88px** | 80px A4 |
| `.heading-hero` | **64px** | 52px A4 |
| `.heading-1` | **40-48px** | 34px A4 |
| `.body-lg` | **20-22px** | 17px A4 |
| `.body` | **14-15px** | 15px A4 |
| `.body-small` | **12-13px** | 13px A4 |
| `.caption` | **10-11px** | 11px A4 |

**Regra prática**: para slide 16:9, aumente fontes ~30% em relação ao A4.

## Modality colors

| Modality | Primary | Uso |
|----------|---------|-----|
| `institucional` | `#009DB7` (teal) | Institucional ENS |
| `mba` | `#005563` (teal escuro) | MBAs |
| `graduacao` | `#F57222` (laranja) | Graduação |
| `chcs` | `#009688` (teal médio) | CHCS |
| `cursos` | `#FFA000` (âmbar) | Cursos |
| `imersao_internacional` | `#BD7904` (dourado) | Imersões |
| `china_immersao` | `#FF0000` (vermelho) | Imersão China (paper preto) |

## Lições críticas (resumo)

Ver `references/lessons-learned.md` para detalhes. **Top 5 lições**:

1. **🔴 CRÍTICO**: `node scripts/patch-dom-to-pptx.js` após `npm install` (fix SVG className)
2. **🔴 CRÍTICO**: Composição ÚNICA por slide 16:9 (NÃO converter de A4)
3. **🔴 CRÍTICO**: `<img>` full-bleed / `background-image: url(...)` SOMEM no PPTX se div pai não tem `background` CSS — usar pipeline híbrido (RECOMENDADO: pptxgenjs-full.js)
4. **🔴 CRÍTICO**: `dom-to-pptx` 16:9 default é 10x5.625 inches — sempre passar `pptxOptions: { width: 13.333, height: 7.5 }`
5. **🔴 CRÍTICO**: mentalidade "PPTX É LANDING PAGE" — 4-6 seções por slide, whitespace intencional

## Ver também

- `references/CROSS-REFERENCES.md` — como esta skill conversa com o arsenal frontend (impeccable-design-polish, taste-skill, etc)
- `references/lessons-learned.md` — 23 lições críticas detalhadas
- `references/troubleshooting.md` — guia de problemas comuns
- **Skill irmã** `pdf-studio` (A4/A5) — para documentos, não apresentações

## Histórico de versões

- **v3.5 (2026-06-26)**: Preferências visuais hardcoded (graduação laranja, fundo creme, sem emojis). Skill integrada ao arsenal Nexus.
- **v3.4 (2026-06-26)**: Pipeline híbrido DEPRECADO. `compose-pptxgenjs-full.js` é o novo padrão.
- **v3.3 (2026-06-26)**: Tentativa de pipeline híbrido (corrompia PPTX). Lição 21.
- **v3.2 (2026-06-23)**: Versão inicial com dom-to-pptx puro.

## Nota sobre integração com arsenal Nexus

Esta skill é **standalone** (Node.js + Chromium próprio) mas se beneficia de:

- **impeccable-design-polish** (creative/) — auditoria visual dos HTMLs antes de gerar PPTX
- **taste-skill** (creative/) — dials anti-slop pra evitar PPTX genérico
- **frontend-design** (creative/) — workflow 6-passos aplicado a slides
- **theme-factory** (creative/) — 10 temas pré-prontos (escolha 1 pra todo o deck)
- **marketing-psychology** (creative/) — heurísticas persuasivas pra CTAs nos slides
- **paywall-upgrade-cro** (creative/) — quando o último slide é CTA de conversão
- **nexus-token-map** (creative/) — garantir que cores do deck batem com PRD Nexus

Ver `references/CROSS-REFERENCES.md` para o workflow completo de uso.
