# Cross-References: pptx-studio ↔ Arsenal Nexus + Open Design

Esta doc explica como a `pptx-studio` se integra com as skills de design e marketing do arsenal Nexus Agent + inspirations do open-design. Use como guia de workflow ao gerar apresentações.

**v3.5+ update:** 4 novos primitives (timeline, comparison, quote, stats) inspirados em design-systems modernos (Stripe, Linear, Notion, edX).

## Workflow integrado (8 passos)

```
1. brainstorming         → expandir brief (audience, objetivo, métricas)
2. frontend-design       → wireframe dos slides (estrutura, hierarquia)
3. theme-factory         → escolher tema (light/dark/clay/etc)
4. nexus-token-map       → validar cores batem com PRD
5. impeccable-design-polish → auditar HTMLs antes de gerar
6. taste-skill           → verificar anti-slop (genérico vs premium)
7. marketing-psychology  → CTAs persuasivos nos slides finais
8. pptx-studio           → renderizar PPTX (compose-pptxgenjs-full.js)
```

## Mapeamento skill-por-skill

| Skill arsenal | Quando invocar | O que aplica no pptx-studio |
|---------------|----------------|-----------------------------|
| **brainstorming** (software-development/) | ANTES de criar `pages/<projeto>/` | Estrutura o brief expandido. Quem é o público, qual o CTA, qual a hierarquia de informação. |
| **frontend-design** (creative/) | ANTES de escrever os `.html` | Workflow 6-passos: brief → direção → design real → production code → polish → self-review. Aplique em cada slide. |
| **theme-factory** (creative/) | AO ESCOLHER tema visual | 10 temas pré-prontos (light/dark/clay/mono/etc). Escolha 1 e aplique consistente em todos os slides via `engine/theme.js`. |
| **nexus-token-map** (creative/) | AO DEFINIR modality colors | Valida que as cores do `theme.js` (mba=#005563, graduacao=#F57222) batem com o PRD Nexus. Se tiver conflito, PRD vence. |
| **impeccable-design-polish** (creative/) | APÓS escrever os `.html`, ANTES de gerar PPTX | Roda auditoria: 4-6 seções por slide, hierarchy/spacing/color/tipo/estado, accessibility. Lista de fixes antes de prosseguir. |
| **taste-skill** (creative/) | APÓS polish, ANTES de gerar | Dials anti-slop: verificar que o deck NÃO parece template (genérico, intercambiável, sem opinião). |
| **marketing-psychology** (creative/) | AO escrever COPY dos slides | Heurísticas persuasivas pra CTAs, headlines, social proof. Especial atenção nos slides 7-9 (CTA). |
| **paywall-upgrade-cro** (creative/) | SE o último slide é CTA de venda/conversão | Padrões de pricing page aplicado a slide final. |
| **claude-design** (creative/) | Como wrapper conceitual | Filosofia geral: opinionated, semantic CSS primitives, no templates. Mesmo princípio do pptx-studio. |
| **canvas-design** (creative/) | SE for gerar imagens pra slides | Curadoria visual: layout, hierarchy, color. Mas pptx-studio usa HTML+CSS, não canvas HTML5. |
| **competitive-ads-extractor** (creative/) | SE for gerar deck de vendas | Análise de padrões de competidores pra informar copy. |

## Princípios compartilhados

| pptx-studio | Arsenal Nexus | Por que batem |
|-------------|---------------|---------------|
| NUNCA templates | frontend-design: "ship working frontend code with a clear design point of view" | Ambos rejeitam layout genérico. |
| Composição única por slide | impeccable-design-polish: 4-6 seções por página | Mesma densidade visual. |
| Modality colors hardcoded | nexus-token-map: PRD é source of truth | Tokens centralizados, não retrabalho. |
| Font sizes 30-50% maiores que A4 | frontend-design: typography scale matters | Aspect ratio diferente exige hierarquia diferente. |
| CSS primitives (`.card-flat`, `.kpi-number`) | claude-design: semantic primitives | Mesmo vocabulário visual. |
| NUNCA emojis (SVG/lucide via PNG) | taste-skill: anti-slop "decorative blobs without product purpose" | Mesmo repúdio a decoration over substance. |

## Anti-patterns compartilhados (evitar em AMBOS)

- ❌ Purple-blue gradient como accent (substitua por cyber teal + neon coral)
- ❌ Inter font (substitua por Space Grotesk + JetBrains Mono)
- ❌ 3-card feature row genérico com ícones idênticos
- ❌ Marketing adjectives vazios ("revolutionary", "cutting-edge")
- ❌ Card-heavy layouts sem hierarquia clara

## Inspirações visuais (open-design)

A `pptx-studio` é uma **skill standalone** (Node.js + Chromium próprio) e NUNCA foi feita pra importar templates do open-design (que são HTMLs pra Claude Design, não pra PPTX). Mas os **princípios visuais** do open-design serviram de inspiração:

| Primitive pptx-studio (v3.5+) | Inspirado em | Onde usar |
|--------------------------------|--------------|-----------|
| `.timeline` + `.timeline-item` + `.timeline-dot` | Stripe changelogs, Linear roadmap, Notion timelines | Historia da empresa, milestones, roadmap de produto |
| `.comparison` + `.comparison-col` | Stripe pricing tables, Linear upgrade pages, SaaS landing pages | Com diploma vs sem, antes vs depois, plano A vs B |
| `.quote` + `.quote-mark` + `.quote-avatar` | edX testimonials, Coursera reviews, Airbnb stories | Depoimentos de alunos, citações de professores |
| `.stats-grid` + `.stat` + `.stat-large` | Stripe metrics, Notion homepage, Vercel stats | Big numbers (50+ anos, 100k+ alunos, 5x crescimento) |

**Como usar**: copie a estrutura HTML do template (`templates/timeline.html`, `templates/comparison.html`) e customize. O CSS está em `primitives/{timeline,comparison,quote,stats}.css`.

## Componentes disponíveis (v3.5+)

### 1. Timeline (novo v3.5+)

**Use pra**: história, milestones, roadmap, cronograma.

**Estrutura HTML** (ver `templates/timeline.html`):

```html
<div class="timeline">
  <div class="timeline-item timeline-milestone">  <!-- milestone: dot laranja -->
    <div class="timeline-marker"><div class="timeline-dot"></div></div>
    <div class="timeline-content">
      <div class="timeline-year heading-2 text-primary">1971</div>
      <div class="timeline-title heading-3">Fundacao da ENS</div>
      <div class="timeline-desc body">Descricao do marco.</div>
    </div>
  </div>
  <!-- mais items -->
</div>
```

**Variantes**:
- `timeline-milestone` — dot maior e laranja (destaque)
- `timeline-horizontal` — linha horizontal (roadmap)
- Default: linha vertical, dots teal (#005563)

### 2. Comparison (novo v3.5+)

**Use pra**: A vs B, com vs sem, antes vs depois.

**Estrutura HTML** (ver `templates/comparison.html`):

```html
<div class="comparison">
  <div class="comparison-col">
    <div class="comparison-header">
      <div class="comparison-tag tag-soft">SEM DIPLOMA</div>
      <h2 class="comparison-title heading-2">Trabalho informal</h2>
      <div class="comparison-price heading-display text-ink-soft">R$ 0</div>
    </div>
    <ul class="comparison-list">
      <li class="comparison-item comparison-item-neg">
        <span class="comparison-icon"></span> Sem registro
      </li>
    </ul>
  </div>
  <div class="comparison-col comparison-col-featured">  <!-- borda destaque -->
    <!-- coluna B (recomendada) -->
  </div>
</div>
```

**Variantes**:
- `comparison-col-featured` — borda teal 2px + tag "RECOMENDADO"
- `comparison-3col` — 3 colunas
- `comparison-item-pos` (verde) / `comparison-item-neg` (cinza)

### 3. Quote (novo v3.5+)

**Use pra**: depoimento de aluno, citação, prova social.

**Estrutura HTML** (template a criar):

```html
<div class="quote">
  <div class="quote-mark">&ldquo;</div>
  <blockquote class="quote-text heading-2">
    Citacao aqui.
  </blockquote>
  <div class="quote-author">
    <div class="quote-avatar">
      <img src="assets/avatar.jpg" alt="Foto" />
    </div>
    <div class="quote-author-info">
      <div class="quote-name heading-3">Nome do aluno</div>
      <div class="quote-role caption text-ink-soft">Cargo · Turma 2024</div>
    </div>
  </div>
</div>
```

**Variantes**:
- `quote-left` — alinhado a esquerda
- `quote-stat` — com stat embaixo (ex: "97% recomendam")
- `quote-grid` — 3 quotes lado a lado

### 4. Stats (novo v3.5+)

**Use pra**: destacar 1-3 números grandes com prefixo/sufixo.

**Estrutura HTML** (template a criar):

```html
<div class="stats-grid">
  <div class="stat">
    <div class="stat-prefix">+</div>
    <div class="stat-number heading-display">50</div>
    <div class="stat-suffix">anos</div>
    <div class="stat-label eyebrow">de mercado</div>
  </div>
  <div class="stat stat-large">  <!-- 2x maior -->
    <div class="stat-number heading-display text-primary">100k</div>
    <div class="stat-suffix">+</div>
    <div class="stat-label eyebrow">alunos</div>
  </div>
</div>
```

**Variantes**:
- `stat-large` — 2x maior (highlight)
- `stat-accent` — cor primaria
- `stat-inverse` — fundo escuro
- `stats-vertical` — 1 stat por linha, full-bleed

## Quando NÃO usar pptx-studio

- **Documentos A4/A5** → use `pdf-studio` (engine diferente, skill irmã)
- **Imagens únicas** → use `comfyui` ou `canvas-design`
- **Demos visuais web** → use `frontend-design` direto (Next.js/HTML)
- **Email/Newsletter** → use `email-marketing` (se existir) ou HTML simples

## Como buildar (v3.5+)

```bash
cd /opt/pptx-studio  # ou onde estiver
npm ci --omit=dev
node scripts/patch-dom-to-pptx.js
npm run build:css:full  # compila todos os modulos (timeline, comparison, quote, stats)
node engine/compose-pptxgenjs-full.js <out-dir> <name>
```

**v3.5+ mudou o build**: agora `build:css:full` (engine/build-css-v2.js) concatena todos os .css de primitives/ em dist/styles.css. O `build:css` antigo (build-css.js) também funciona mas nao inclui os novos primitives.

## TODO (v3.6+)

- [ ] Generalizar `compose-pptxgenjs-full.js` pra aceitar qualquer projeto (hoje so renderiza `gestao_seguros_em_2026`)
- [ ] Adicionar renderers especificos pros novos primitives (timeline, comparison, quote, stats) usando pptxgenjs
- [ ] Criar testes E2E que renderizam cada primitive e validam
- [ ] Adicionar CI workflow
- [ ] Migrar `compose-hybrid-pptxgenjs.js` e `merge-pptx.js` para `_deprecated/`

## Skill irmã: pdf-studio

| Aspecto | pptx-studio | pdf-studio |
|---------|-------------|------------|
| Output | PPTX 16:9 (slides) | PDF A4/A5 (docs) |
| Engine | pptxgenjs / dom-to-pptx | Playwright + pdf-lib |
| Layout | Horizontal (slides wide) | Vertical (pages) |
| Font scale | 30-50% MAIOR que A4 | A4 base |
| Theme | Light default | Light default |
| Use case | Apresentações | Documentos, e-books |

**NÃO trocar entre eles** — composições são diferentes. Mesmo brief pode ter versão slides (pptx) E versão documento (pdf) se necessário.
