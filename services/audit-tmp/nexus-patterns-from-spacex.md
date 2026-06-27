# Patterns extraídos do spacex DESIGN.md — aplicáveis ao Nexus

**Fonte:** open-design/design-systems/spacex (Apache 2.0)
**Data extração:** 2026-06-27
**Aplicabilidade ao Nexus PRD:** alta (mesma estética dark + cinematic)

## Pattern 1: Tokens narrativos (com comentários)

O spacex tokens.css é EXEMPLAR em narrar cada decisão. Em vez de só listar
variáveis, ele explica PORQUÊ de cada escolha:

```css
/* ─── Surface ─────────────────────────────────────────────────────
 * The void of space. There is no card tier, no warm tier — every
 * SpaceX section is text-on-photograph, not text-on-surface. We
 * still declare --surface so cross-brand components that paint a
 * card still resolve, but it deliberately matches --bg. */
--bg: #000000;
--surface: #000000;
```

**Aplicação Nexus:** reescrever `tokens.css` do Nexus com narrativa similar.
Cada cor/gradient/efeito acompanhado do "porquê".

## Pattern 2: Zero-card discipline

SpaceX: "The absence of containers IS the design."

**Aplicação Nexus:** nos hero e seções above-the-fold, evitar cards.
Texto direto sobre gradiente/foto. Usar cards só em dashboards/data-dense.

## Pattern 3: Single ghost button

SpaceX tem UM botão em toda a homepage: `rgba(240,240,250,0.1)` bg,
32px radius, border `rgba(240,240,250,0.35)`. Hover brilha.

**Aplicação Nexus:** CTAs primários podem usar pattern similar:
- bg `rgba(0, 210, 255, 0.1)` (cyber teal 10% opacity)
- border `rgba(0, 210, 255, 0.5)` (cyber teal 50%)
- hover: full opacity cyber teal + glow

## Pattern 4: Universal uppercase + tracking positivo

SpaceX usa uppercase em TUDO, com tracking 0.96-1.17px.

**Aplicação Nexus:** NÃO copiar (o PRD usa Space Grotesk com case misto).
MAS o pattern de "letter-spacing consistente como identidade" vale.
PRD §2.2: Space Grotesk tem tracking display `tracking-display: -0.025em`.

## Pattern 5: Spectral White (não #FFFFFF)

SpaceX usa `#f0f0fa` (azul-violeta sutil) em vez de branco puro.

**Aplicação Nexus:** considerar foreground `#F8F7FF` (já próximo do spectral)
em vez de `#FFFFFF` puro. Reduz "feel clínico" sobre fundo escuro.

## Pattern 6: 50% overlay gradient

SpaceX usa `rgba(0,0,0,0.5)` gradient sobre fotos pra garantir legibilidade.

**Aplicação Nexus:** para hero com imagem full-viewport, gradient
`rgba(10,10,26,0.7)` (Obsidian 70%) sobre foto + cyber teal accent.

## Pattern 7: D-DIN industrial heritage

SpaceX usa D-DIN (DIN heritage) = tipo industrial geométrica.

**Aplicação Nexus:** Space Grotesk já tem DNA similar (geométrica, moderna).
Combina com PRD §2.2.

## Pattern 8: Compressed leading 1.0

SpaceX usa line-height 0.94-1.0 (muito comprimido) pra sensação
"mission-critical briefing".

**Aplicação Nexus:** PRD §2.2 define `--leading-tight: 1.06`. Aplicar
em headlines e labels. NÃO aplicar em body (mantém 1.52 do PRD).

## Pattern 9: Single source of truth para tokens

SpaceX tem tokens.css + DESIGN.md em perfeita sincronia. Cada token
citado no DESIGN.md está no CSS com mesmo nome.

**Aplicação Nexus:** garantir que DESIGN.md + tokens.css não divirjam.
Criar teste automatizado que falha se tokens.css referencia cor não
documentada em DESIGN.md.

## Resumo: 6 patterns críticos pra implementar agora

1. ✏️ Reescrever tokens.css do Nexus com narrativa (Pattern 1)
2. ✏️ CTAs primários como "ghost button cyber teal" (Pattern 3)
3. ✏️ Considerar fg `#F8F7FF` em vez de `#FFFFFF` (Pattern 5)
4. ✏️ Hero overlay gradient em Obsidian 70% (Pattern 6)
5. ✏️ Validar leading 1.06 em headlines (Pattern 8)
6. ✏️ Garantir DESIGN.md ↔ tokens.css sincronizados (Pattern 9)

**Não implementar (não alinhado com PRD Nexus):**
- Universal uppercase (Pattern 4) — Nexus usa Space Grotesk case mixto
- Zero-card absoluto (Pattern 2) — Nexus vai usar cards em dashboards
