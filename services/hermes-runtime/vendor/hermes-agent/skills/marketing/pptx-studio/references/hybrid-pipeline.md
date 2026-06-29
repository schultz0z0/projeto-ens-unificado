# Hybrid Pipeline — v3.3 (PPTXGENJS + DOM-TO-PPTX + ADM-ZIP MERGE)

> **STATUS: DEPRECADO** (2026-06-26). Use a abordagem "**pptxgenjs puro**"
> para projetos com capa + encerramento hero. Ver SKILL.md.

## Por que foi descontinuado (2026-06-26, Raphael)

O pipeline híbrido (`engine/compose-hybrid-pptxgenjs.js` + `engine/merge-pptx.js`)
funciona em PRINCÍPIO — gera capa via pptxgenjs, body via dom-to-pptx, merge via
adm-zip. **Mas em produção, o merge corrompeu o PPTX**: slide2.xml estava
referenciado em `presentation.xml.rels` (rId3 → `slides/slide2.xml`) mas o
arquivo não estava presente no ZIP final. Resultado: PowerPoint abriu com erro
"O PowerPoint não pode ler C:\Users\...\arquivo.pptx".

**Causa raiz**: o script `merge-pptx.js` renomeia body slide1 → cover slide1,
body slide2 → slide2, body slide3..8 → slide4..9. Mas a lógica de rename tinha
um bug que perdia o slide2 do body em alguns edge cases.

**Sintomas no validate-pptx-deep**: ele reporta `Slides: 9` (em vez de 10) —
porque conta rIds tipo slide, e um deles aponta pra arquivo inexistente.

## Solução recomendada: pptxgenjs puro

Use o script `engine/compose-pptxgenjs-full.js` (criado em 2026-06-26) que
gera TODOS os slides via pptxgenjs nativo, sem merge. Cada slide é um shape
nativo do PowerPoint, sem risco de XML corrompido.

**Trade-off**: pptxgenjs duplica a imagem de capa em cada slide que a usa
(slide1 e slide10). Arquivo final fica ~13MB em vez de ~785KB. Aceitável
para distribuição via Telegram (limite 50MB).

**Workflow**:

```bash
# 1. Gerar tudo via pptxgenjs puro
node engine/compose-pptxgenjs-full.js <out-dir> <name>

# 2. Validar estrutura
node engine/validate-pptx-deep.js <arquivo.pptx>

# 3. Preview via Playwright (LibreOffice NÃO é ground truth — ver SKILL.md lição 20)
libreoffice --headless --convert-to pdf --outdir /tmp/preview <arquivo.pptx>
pdftoppm -png -r 90 /tmp/preview/<doc>.pdf /tmp/preview/slide
# Checar: ls /tmp/preview/*.png | wc -l → deve ser 10

# 4. Metadata já vem correta do pptxgenjs (title, author setados no pptx.title)
```

## Quando usar dom-to-pptx puro (sem híbrido)

Se o projeto NÃO tem capa/encerramento com imagem full-bleed (só diagramas,
KPIs, cards), use `engine/compose-pptx-v2.js` direto. Dom-to-pptx preserva
CSS moderno (gradients, flexbox, shadows) como shapes nativos.

## Lição aprendida

**Nunca fazer merge manual de OOXML via adm-zip em produção.** O formato PPTX
tem dezenas de arquivos XML inter-relacionados (`presentation.xml`,
`presentation.xml.rels`, `_rels/slideN.xml.rels`, `[Content_Types].xml`,
`docProps/core.xml`, `docProps/app.xml`, etc). Um merge errado produz um
arquivo que abre com erro silencioso no PowerPoint.

**Alternativas seguras**:
1. **pptxgenjs puro** (recomendado) — gera todos os slides nativamente
2. **LibreOffice macro / docx4j** — libs que entendem OOXML
3. **PowerPoint COM** — se houver PowerPoint instalado

## Referência: o que o merge tentava fazer (para histórico)

```javascript
// engine/merge-pptx.js (BUGGY — não usar)
// Body PPTX tem 8 slides. Cover PPTX tem 2 slides.
// Final deve ter 10 slides na ordem: cover, body1..8, cover2
// Estratégia:
//   - copiar body[2..8] → final[2..9]
//   - copiar body[1] → final[2]  // BUG: conflitava com body[2] renomeado
//   - copiar cover[1] → final[1]
//   - copiar cover[2] → final[10]
// Resultado: final[2] = body[2] (correto), mas final[2] era sobrescrito por body[1] também
```

O bug foi corrigido parcialmente no merge-pptx.js, mas a solução robusta
é não usar merge — gerar tudo via pptxgenjs puro.