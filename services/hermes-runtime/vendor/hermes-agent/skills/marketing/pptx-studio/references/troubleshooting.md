# pptx-studio — Troubleshooting & Sessões Anteriores

> Documento de referência. Bugs conhecidos, workarounds, e lições
> práticas que emergiram de sessões de uso real.

## Como o framework é organizado

`pptx-studio` é uma **skill irmã** do `pdf-studio`:
- `pdf-studio` = PDF A4/A5 via Playwright + pdf-lib (`/opt/data/skills/marketing/pdf-studio/`)
- `pptx-studio` = PPTX 16:9 via dom-to-pptx + PptxGenJS (`/opt/data/skills/marketing/pptx-studio/`)

**Por que SEPARADO e não unificado**: `npm install puppeteer` (dep do dom-to-pptx) já apagou arquivos do projeto uma vez durante uma sessão. Manter diretórios separados com `node_modules` próprio e `package.json` próprio isola a falha. Se um framework quebrar, o outro continua intacto.

---

## Bugs críticos e workarounds

### 🛑 1. SVG inline quebra com "node.className.split is not a function"

**Sintoma**: ao renderizar HTML com qualquer `<svg class="...">`, o dom-to-pptx falha com erro no Chromium:

```
Programmatic export failed: node.className.split is not a function
    at exportHtmlToPptx (.../dom-to-pptx-node.cjs:293:13)
```

**Causa**: `SVGElement.className` é `SVGAnimatedString` (objeto), não `string`. O bundle do dom-to-pptx chama `.className.split()` diretamente.

**Fix** (após cada `npm install`):
```bash
cd /opt/data/skills/marketing/pptx-studio
node scripts/patch-dom-to-pptx.js
```

O script substitui `(\w+)\.className\.split\(` por `String($1.className || "").split(` em dois arquivos:
- `node_modules/dom-to-pptx/dist/dom-to-pptx.cjs`
- `node_modules/dom-to-pptx/dist/dom-to-pptx.bundle.js`

**Idempotente** — detecta se já tá patchado. **PR suggestion upstream**: o repo `atharva9167j/dom-to-pptx` aceita PRs; vale enviar fix.

### 🛑 2. `<div class="slide">` aninhado duplica contagem de slides

**Sintoma**: o `validate-pptx-deep.js` reporta **2x o número real de slides** (ex: 16 em vez de 8). O `compose-pptx-v2.js` reporta corretamente.

**Causa**: o HTML da página já tem `<div class="slide">` (porque o slide é escrito com `.slide` no body), e o `wrapAsSlide` do engine **envelopa** isso em OUTRO `<div class="slide">`. Resultado: slide aninhado.

**Fix** (no `engine/compose-pptx-v2.js`): o `wrapAsSlide` extrai o conteúdo INTERNO do `<div class="slide">` se ele existir:

```javascript
// Se body já tem <div class="slide"> envolvente, extrai o conteúdo INTERNO
const slideMatch = bodyContent.match(/<div class="slide"[^>]*>([\s\S]*?)<\/div>\s*$/i);
if (slideMatch) {
  bodyContent = slideMatch[1];
}
```

### 🛑 3. `npm install` apaga arquivos do projeto

**Sintoma**: depois de rodar `npm install` (especialmente `puppeteer` ou `dom-to-pptx`), arquivos que você escreveu com `write_file` somem — tipicamente metade das páginas HTML.

**Causa**: npm às vezes faz "limpeza" de arquivos "órfãos" no diretório onde está rodando. Não é documentado claramente mas acontece.

**Workaround**:
- Use diretórios dedicados com `package.json` próprio
- Escreva arquivos DEPOIS do último `npm install`
- Se precisar instalar deps, faça TODAS as edições antes
- Ou use `npm install --ignore-scripts` e rode o patch manualmente

**Caso real**: durante esta sessão, `npm install adm-zip` apagou 4 das 8 páginas HTML do `mba_ens_2026/`. Tivemos que reescrever.

### 🛑 4. PowerPoint mostra slide "fora do enquadramento"

**Sintoma**: o PPTX é gerado com slide size 13.333x7.5in (correto), mas ao abrir no PowerPoint, o conteúdo aparece **ancorado no canto direito** com a metade esquerda do canvas vazia/escura.

**Causa**: gradients complexos (`linear-gradient(90deg, ...)`) são convertidos pelo dom-to-pptx em SVG vetorial, e a PowerPoint não renderiza esses SVGs corretamente.

**Fix**: usar **cor sólida** com overlay semi-transparente, em vez de gradient:
```css
/* NÃO FAZER */
background: linear-gradient(90deg, rgba(0,85,99,0.3) 0%, rgba(0,85,99,0.95) 100%);

/* FAZER */
background: rgba(0, 85, 99, 0.88);  /* cor sólida semi-transparente */
```

### 🛑 5. page.pdf() no Playwright ignora width/height e usa A4

**Sintoma**: ao tentar renderizar PDF 16:9 com Playwright, mesmo passando `width: '1280px', height: '720px'`, o PDF sai 540x960 (A4 portrait). Testado em playwright 1.61.0.

**Causa**: bug específico do Chromium que SWAPPA width/height quando aspect ratio é 16:9 (relacionado a `landscape: true` que também está bugado).

**Workaround**: usar `setContent` em vez de `goto(file://)` E setar viewport 1280x720 ANTES do setContent. **OU** usar dom-to-pptx (que tem seu próprio tratamento de dimensão).

```javascript
await page.setViewportSize({ width: 1280, height: 720 });
await page.setContent(html, { waitUntil: 'networkidle' });
```

### 🛑 6. PowerPoint "não pode ler" + Content_Types com Overrides fantasma (2026-06-26)

**Sintoma**: erro genérico `O PowerPoint não pode ler C:\...\arquivo.pptx`. ZIP válido, mas PowerPoint faz validação estrita do Content_Types antes de abrir. Validators custom (`validate-pptx-deep.js`) NÃO pegam — eles contam rIds mas não cross-checam Content_Types vs arquivos reais.

**Causa típica**: merge adm-zip (qualquer operação que combine 2 PPTXs) deixa o Content_Types com `<Override PartName="X">` onde X não existe no ZIP. Exemplo real: Content_Types declarando 10 slideMaster (`slideMaster1` a `slideMaster10`) mas só `slideMaster1.xml` no ZIP.

**Diagnóstico** (Python):
```python
import zipfile, re
with zipfile.ZipFile('file.pptx') as z:
    names = set(z.namelist())
    ct = z.read('[Content_Types].xml').decode('utf-8')
    for m in re.finditer(r'<Override PartName="([^"]+)"', ct):
        if m.group(1).lstrip('/') not in names:
            print(f"FANTASMA: {m.group(1)}")
```

**Repair** (remover Overrides órfãos):
```python
import zipfile, re
with zipfile.ZipFile('file.pptx') as zin:
    contents = {n: zin.read(n) for n in zin.namelist()}
ct = contents['[Content_Types].xml'].decode('utf-8')
names = set(contents.keys())
ct = re.sub(r'<Override PartName="([^"]+)" ContentType="([^"]+)"/>',
    lambda m: m.group(0) if m.group(1).lstrip('/') in names else '', ct)
contents['[Content_Types].xml'] = ct.encode('utf-8')
with zipfile.ZipFile('file.pptx', 'w', zipfile.ZIP_DEFLATED) as zout:
    for n, d in contents.items(): zout.writestr(n, d)
```

**Validação final (ground truth)**: `python -c "from pptx import Presentation; Presentation('file.pptx')"` — se não levantar exceção, PowerPoint aceita. Mais confiável que LibreOffice.

**Script reutilizável**: `node scripts/check-pptx-integrity.js file.pptx` — valida 4 classes de problemas (Content_Types Overrides, presentation.xml.rels targets, sldIdLst rIds, slide→media refs). Exit 0 = OK, exit 1 = problemas. Rodar SEMPRE após merge ou edição manual de XML.

**Heurística**: se `validate-pptx-deep.js` reporta OK mas PowerPoint recusa abrir, é Content_Types em 90% dos casos. Verificar primeiro antes de regenerar.

---

## Decisões de design validadas em produção

### Cada formato precisa de composição ÚNICA

**Regra testada**: NUNCA converter A4 → 16:9 com `width/height forçado`. Cada formato (A4, A5, slide 16:9) precisa de HTML escrito do zero com:
- Font-sizes diferentes (slide = 30-50% maior que A4)
- Layouts diferentes (slide = horizontal/wide, A4 = vertical/portrait)
- Splits diferentes (slide 60/40 wide, A4 35/65 narrow)
- Composição única (hero horizontal vs capa centralizada)

**Exemplo de bug**: p3 do MBA ENS 2026 convertida de A4 → 16:9 saiu com "espaço vazio à esquerda + texto pequeno". Re-escrita com hero full-width + 3 features em row resolveu.

### Font-sizes para slide 16:9

| Contexto | A4 | 16:9 |
|---|---|---|
| Display | 64-80px | **88px** |
| Heading 1 | 34px | **40-48px** |
| Body lg | 17px | **20-22px** |
| Body | 15px | **14-15px** |
| Caption | 11px | **10-11px** |

### Logo ENS para slides

**Versão SVG inline** (não PNG) é melhor porque:
- dom-to-pptx converte SVG para shapes vetoriais (não raster)
- Escala perfeita em qualquer resolução
- Menor tamanho de arquivo

**Pattern usado no MBA ENS 2026**:
```html
<div class="logo-ens logo-ens-2xl" style="color: var(--primary);">
  <svg viewBox="0 0 256 52" width="280" height="56" style="color: var(--primary);">
    <rect x="0" y="8" width="36" height="36" rx="4" fill="#005563"/>
    <text ...>E</text>
    <text ...>ENS</text>
    <text ...>Escola de Negócios e Seguros</text>
  </svg>
</div>
```

### Validação programática é suficiente (sem LibreOffice)

O `validate-pptx-deep.js` (via adm-zip) garante:
- ZIP válido
- Estrutura OOXML completa
- Slide size 16:9 correto
- Contagem de slides
- Imagens embedadas (formato + dimensões reais)
- Textos extraídos com fidelidade
- Metadata (title, creator)

**Não valida visualmente** (precisa abrir no PowerPoint pra ver). Mas é o suficiente pra garantir que o arquivo ABRE e tem a estrutura correta.

**Validação visual** (com LibreOffice convertendo pra PDF) precisa root pra instalar. Como não temos root no container, a validação visual é feita manualmente pelo Raphael abrindo no PowerPoint.

---

## Workflow de validação final recomendado

```bash
# 1. Render
cd /opt/data/skills/marketing/pptx-studio
node engine/compose-pptx-v2.js --project mba_ens_2026 --out-dir /tmp --name mba \
  --kv '{"modality":"mba","title":"MBAs ENS 2026","author":"ENS"}'

# 2. Valida estrutura
node engine/validate-pptx-deep.js /tmp/mba.pptx
# Esperado:
#   Slide size:  12191695x6858000 EMU = 13.333x7.500 inches
#   Slides:      8
#   ✓ PPTX OK — estrutura válida, sem warnings.

# 3. Envia pra Telegram (visual)
curl -X POST "https://api.telegram.org/bot<TOKEN>/sendDocument" \
  -F chat_id=<chat_id> \
  -F document=@/tmp/mba.pptx \
  -F caption="<descrição>"

# 4. Usuário (Raphael) abre no PowerPoint e aprova ou pede rounds de iteração
# 5. Se aprovado: entrega final
# 6. Se rejeitado: itera na composição da página específica
```

---

## Comparação com alternativas (rejeitadas durante exploração)

| Abordagem | Por que rejeitada |
|---|---|
| PptxGenJS puro | API muito limitada (coordenadas absolutas), não preserva CSS moderno |
| Conversão A4 → 16:9 com `!important` | Gera layout espremido, texto pequeno, espaço vazio |
| HTML → PDF → PPTX via LibreOffice | Gera imagens estáticas (não editáveis no PowerPoint) |
| dom-to-pptx sem patch SVG | Falha com qualquer SVG inline |
| Tentar unificar com pdf-studio | `npm install` apaga arquivos do outro framework |

---

## Histórico de versões

- **v3.2 (atual)**: framework separado do pdf-studio. 8 slides MBA ENS 2026 16:9, 61KB
- **v1.0 (rejeitada)**: PptxGenJS puro, sem preservação de CSS moderno
- **v0.0 (rejeitada)**: HTML→PDF→PPTX via LibreOffice, gerava imagens estáticas (não editáveis)
- **v0.0 (rejeitada)**: tentativa de unificar com pdf-studio em uma skill só — quebrou por `npm install` cross-contamination
