# Lições Críticas do pptx-studio — Sessão 2026-06-23/24

> Lições aprendidas em produção com dom-to-pptx + PptxGenJS. Cada uma é um
> pitfall que custou horas de debug. Adicione aqui quando descobrir um novo.

## 🔴 CRÍTICO: `npm install` pode DELETAR arquivos do projeto (2026-06-24)

**Problema**: Raphael perdeu o `compose-pptx-v2.js`, `validate-pptx-deep.js`, e `pages/mba_ens_2026/p*.html` várias vezes em 2026-06-24. Causa: ao rodar `npm install puppeteer` (deps do `dom-to-pptx`), o `npm` "limpou" arquivos do projeto (considerou como "orfãos" durante resolução de conflito de deps).

**Por que aconteceu**:
- O `pptx-studio/` não tinha `.gitignore` com proteção
- Os arquivos foram criados manualmente (não estavam no `package.json`)
- `npm install` com `--ignore-scripts` ainda varre o diretório
- Resultado: arquivos "extras" são removidos

**Fix**:
1. **`.gitignore` SEMPRE**: `node_modules/`, `*.log`, `*.tmp`, `build/`, `*.injected.html`
2. **`package.json` próprio** com deps específicas (não compartilhar com outros frameworks)
3. **Estrutura isolada**: cada framework em diretório separado com `node_modules` próprio
4. **Backup script**: `scripts/snapshot.sh` que copia workspace para `/opt/data/backups/<framework>-<date>/` antes de qualquer `npm install`

**Heurística de detecção**: se após `npm install` um arquivo que existia antes sumir, é bug do npm. Recriar imediatamente e adicionar ao `.gitignore`.

**Workaround durante o recovery**: usar `write_file` tool (que é rápido e atômico) ou Python script via `execute_code` que escreve arquivos via `open('w')`. Esses métodos NÃO são afetados pelo `npm install`.

## 🔴 CRÍTICO: SVG className quebra o dom-to-pptx (precisa patch)

**Problema**: o dom-to-pptx chama `node.className.split(/\s+/)` no bundle injetado no browser. Mas em SVG, `className` é um `SVGAnimatedString` (objeto, não string), não tem `.split()`. Resultado: **"Programmatic export failed: node.className.split is not a function"** e o PPTX não é gerado.

**Sintoma**: PPTX com SVG inline (ícones, etc) falha. PPTX sem SVG funciona. Mesmo patch no `.cjs` (Node bundle) não resolve porque o erro vem do `bundle.js` (UMD bundle injetado no browser).

**Patch obrigatório** (já aplicado via `scripts/patch-dom-to-pptx.js`):
```javascript
// No bundle UMD (dom-to-pptx.bundle.js) E no .cjs (dom-to-pptx.cjs):
// Trocar:
//   XXX.className.split(...)
// Por:
//   String(XXX.className || "").split(...)
```

**Heurística regex** (no `scripts/patch-dom-to-pptx.js`):
```javascript
const re = /(\b\w+)\.className\.split\(/g;
const patched = content.replace(re, 'String($1.className || "").split(');
```

**Quando re-aplicar**:
- ✅ SEMPRE após `npm install dom-to-pptx` (o patch é perdido)
- ✅ Se você ver erro `node.className.split is not a function` no log

**Workflow correto** (CRÍTICO):
```bash
# Após npm install
cd pptx-studio
npm install dom-to-pptx
node scripts/patch-dom-to-pptx.js   # SEMPRE rodar isso depois
node engine/compose-pptx-v2.js ...
```

**PR upstream sugerido**: o fix é simples e beneficia toda a comunidade. Link: https://github.com/atharva9167j/dom-to-pptx/issues

## 🔴 CRÍTICO: Composição ÚNICA por slide 16:9 (NÃO converter de A4)

**Regra do Raphael (REPETIDA)**: cada slide 16:9 é um arquivo HTML **escrito do zero** com layouts horizontais e font-sizes 30-50% maiores que A4. NUNCA forçar `width: 13.333in; height: 7.5in !important` em `.page-a4` existente.

**O que dá errado**:
- A4 desenhado pra 210x297mm tem layouts verticais (split 35/65, hero centralizado, grid 2x2)
- Forçar width/height sem reescrever gera layout espremido, espaço vazio lateral, texto pequeno
- Raphael rejeitou 3 vezes: "o visual do slide veio direitinho, mas o design não está" / "está fora do enquadramento"

**Sintomas de slide mal feito**:
- Logo num canto, título em outro, pills em outro (composição fragmentada)
- Espaço vazio horizontal grande
- Texto proporcional a A4 (15-17px) → ilegível em apresentação
- Layout vertical (split 35/65, hero centralizado) espremido

**Solução**: cada slide tem composição ESPECÍFICA pra 16:9:
- ROW em vez de GRID 2x2 (cards em linha, não em matriz)
- Split 60/40 wide em vez de 35/65 (mais área horizontal)
- Hero full-width com bg image
- Title 88px (display), 40-48px (heading-1)
- Body 20-22px (legível de longe)

**Estrutura típica de slide 16:9**:
```html
<div class="page-slide">  <!-- 1280x720, sempre -->
  <div style="padding: 50px 70px;">  <!-- padding LATERAL maior -->
    <span class="eyebrow">— SEÇÃO</span>
    <h1 class="heading-1" style="font-size: 44px;">Título principal</h1>
    <div style="display: flex; gap: 20px;">  <!-- ROW horizontal -->
      <div style="flex: 1;">Card 1</div>
      <div style="flex: 1;">Card 2</div>
      <div style="flex: 1;">Card 3</div>
    </div>
  </div>
</div>
```

## 🔴 CRÍTICO: CSS inline obrigatório (paths relativos não funcionam)

**Problema**: `setContent(html)` usa `about:blank` como base. Paths relativos como `<link href="../../primitives/dist/styles.css">` NÃO resolvem. CSS não carrega, página colapsa.

**Fix** (já aplicado em `engine/compose-pptx-v2.js`): injetar CSS inline no HTML antes do `setContent`:
```javascript
const cssContent = fs.readFileSync(
  path.join(__dirname, '..', 'primitives', 'dist', 'styles.css'),
  'utf8'
);
injectedHtml = injectedHtml.replace(
  /<link[^>]+rel=["']stylesheet["'][^>]*>/i,
  `<style id="primitives-inline">${cssContent}</style>`
);
```

## 🔴 CRÍTICO: `wrapAsSlide` duplica slides se HTML já tem `<div class="slide">`

**Problema**: o `wrapAsSlide` envelopa cada página em `<div class="slide">`. Mas se o HTML original JÁ tem um `<div class="slide">` (como as páginas do mba_ens_2026, que foram escritas com esse wrapper), a função cria OUTRO slide aninhado, gerando 16 slides em vez de 8 no PPTX final.

**Sintoma**: `validate-pptx-deep.js` reporta `Slides: 16` em vez de 8. O `all-slides.html` combinado tem `<!DOCTYPE>` aninhados e 16 divs `class="slide"`.

**Causa raiz**: o `wrapAsSlide` faz:
```javascript
const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
const bodyContent = bodyMatch ? bodyMatch[1] : html;
// depois envelopa em <div class="slide">${bodyContent}</div>
```

Se o `bodyContent` JÁ contém `<div class="slide">...</div>`, o resultado é `<div class="slide"><div class="slide">...</div></div>` — slide aninhado que o dom-to-pptx conta DUAS vezes.

**Fix** (em `engine/compose-pptx-v2.js`): extrair o conteúdo INTERNO se já tem `.slide`:
```javascript
// Extrai o conteúdo do <body>
const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
let bodyContent = bodyMatch ? bodyMatch[1] : html;

// Se body já tem <div class="slide"> envolvente, extrai o conteúdo INTERNO
const slideMatch = bodyContent.match(/<div class="slide"[^>]*>([\s\S]*?)<\/div>\s*$/i);
if (slideMatch) {
  bodyContent = slideMatch[1];
}

// Agora envelopa em um único <div class="slide">
return `<div class="slide">${bodyContent}</div>`;
```

**Heurística de validação**:
```bash
# Se o PPTX tem 2x mais slides que arquivos HTML:
node engine/validate-pptx-deep.js output.pptx | grep "Slides:"

# Abra o all-slides.html e procure DOCTYPE aninhado
grep -c "<!DOCTYPE" /tmp/pptx-v2-*/all-slides.html
# Se > N (onde N = número de arquivos HTML), há duplicação
```

**Regra**: o `wrapAsSlide` do compose-pptx-v2.js sempre deve gerar UM `<div class="slide">` por arquivo HTML. O conteúdo do HTML pode ou não ter essa div — o wrapper detecta e extrai.

## 🔴 CRÍTICO: `exportHtmlToPptx` API parameter naming (2026-06-24)

**Problema**: o CLI `dom-to-pptx-exporter` aceita `slideWidth`/`slideHeight` (do `args.width`/`args.height`). Mas a API programática `exportHtmlToPptx()` espera `width`/`height` (não `slideWidth`/`slideHeight`). Resultado: passar `slideWidth: 13.333` na API é IGNORADO, PPTX sai em 10x5.625 inches (default, NÃO 16:9).

**Sintoma**: `validate-pptx-deep` reporta `Slide size: 9144000x5143688 EMU = 10.000x5.625 inches` em vez de 13.333x7.5.

**Fix** (em `compose-pptx-v2.js`): usar API programática com `width`/`height`:
```javascript
const buf = await exportHtmlToPptx(htmlPath, {
  width: 13.333,    // NÃO slideWidth
  height: 7.5,      // NÃO slideHeight
  // ... outras opções
});
```

**Heurística**: se slide size != 13.333x7.5, `width`/`height` não foram passados ou foram ignorados.

## 🔴 CRÍTICO: phantom Content_Types overrides = PowerPoint não abre (2026-06-26)

**Sintoma**: PowerPoint mostra erro genérico "O PowerPoint não pode ler C:\\...\\arquivo.pptx". ZIP válido, mas PowerPoint faz validação estrita do Content_Types antes de abrir. Validators custom (`validate-pptx-deep.js`) NÃO pegam porque contam rIds, não cross-checam Content_Types vs arquivos reais.

**Causa típica**: merge adm-zip entre 2 PPTXs (ex: cover_only + body_only) que tinham Content_Types com Overrides diferentes. O merge concatenou, gerando Overrides de arquivos que não estão no ZIP final. Exemplo real: cover_only tinha `<Override PartName="/ppt/slideMasters/slideMaster2..10">` mas só `slideMaster1.xml` existia no ZIP final.

**Diagnóstico** (Python one-liner):
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

**Ground truth final**: `python-pptx` `Presentation(path)` — se abrir sem raise, PowerPoint aceita. Mais confiável que LibreOffice (que pode ser permissivo demais) e que validadores custom.

**Script reutilizável**: `scripts/check-pptx-integrity.js` valida 4 classes de problemas (Content_Types, presentation.xml.rels, sldIdLst, slide→media). Exit 0 = OK, exit 1 = problemas. Rodar SEMPRE após qualquer operação manual no PPTX (merge, edit de XML, troca de imagens).

**Não confundir com lição "slide2.xml faltando"**: lá o ARQUIVO slide2.xml sumiu do ZIP. Aqui o slide2.xml EXISTE, mas Content_Types declara 10 slideMaster onde só 1 está. Sintomas similares, causas e fixes diferentes.

## 🔴 CRÍTICO: Title/Author metadata (2026-06-24)

**Problema**: o `PptxGenJS` (usado internamente pelo dom-to-pptx) define `title: "PptxGenJS Presentation"` por default. Resultado: o PPTX abre "PptxGenJS Presentation" no PowerPoint em vez do título real do documento.

**Sintoma**: `validate-pptx-deep` reporta `Metadata: {"title":"PptxGenJS Presentation","creator":"PptxGenJS"}` em vez do título que você passou via `--kv`.

**Fix** (em `compose-pptx-v2.js`): passar `pptxOptions: { title, author, subject }` ou `coreProps`:
```javascript
const pptxOptions = {
  width: 13.333,
  height: 7.5,
  title: kv.title || 'Documento',
  author: kv.author || 'ENS',
  subject: kv.subject || '',
  company: 'ENS',
};
const buf = await exportHtmlToPptx(htmlPath, { pptxOptions });
```

**Verificação**: o `validate-pptx-deep.js` lê `docProps/core.xml` (não `presentation.xml`). Se aparecer "PptxGenJS Presentation", o title não foi setado.

## 🟡 PADRÃO: Linear gradient com 3+ stops gera "vazio" no PowerPoint

**Problema**: aplicar `background: linear-gradient(90deg, rgba(0,85,99,0.3) 0%, rgba(0,85,99,0.85) 60%, rgba(0,85,99,0.95) 100%)` em slide 16:9 faz o PowerPoint interpretar errado, gerando "vazio" visual onde o gradient é claro.

**Sintoma**: capa do slide com bg teal + photo aparece com a metade esquerda clara (efeito "vazio"), conteúdo ancorado na metade direita.

**Fix**: usar cor SÓLIDA `rgba(0, 85, 99, 0.85)` no overlay, sem gradient.

```html
<!-- ERRADO (gera "vazio" no PowerPoint) -->
<div style="background: linear-gradient(90deg, rgba(0,85,99,0.3) 0%, rgba(0,85,99,0.85) 60%, rgba(0,85,99,0.95) 100%);"></div>

<!-- CERTO (preenche full-width uniformemente) -->
<div style="background: rgba(0, 85, 99, 0.85);"></div>
```

**Heurística**:
- ✅ 2 stops (0% e 100%): funciona
- ❌ 3+ stops ou ângulos específicos: falha
- ✅ Cor sólida: sempre funciona
- ✅ Radial gradient: geralmente funciona

## 🟡 PADRÃO: Logo ENS na capa 16:9 deve ser SVG inline 44-56px

**Por que 44-56px e não 180-220px** (que era o A4): a capa 16:9 é MENOR fisicamente que A4 (1280x720 vs 595x842 em pixels de canvas), mas é vista de longe (tela cheia em apresentação). Logo de 180px no slide 16:9 fica GIGANTE (preenche metade da largura), enquanto 44-56px é proporcional.

**Heurística de tamanho** (slide 16:9):
- Capa: 44-56px height (centralizada no topo)
- Páginas internas: 18-22px (footer com opacity 0.5)
- Encerramento: 60-80px (gigante, color primary)

**Comparação A4 vs 16:9** (logo height):
| Local | A4 (210x297mm) | 16:9 (1280x720) |
|---|---|---|
| Capa | 80-100px | 44-56px |
| Footer interno | 24-32px | 18-22px |
| Encerramento | 100-140px | 60-80px |

## 🟡 PADRÃO: `compose-pptx-v2.js` filter pega arquivos temporários

**Problema**: `files.filter(f => /^p\d+_.+\.html$/.test(f))` aceita QUALQUER arquivo `p1_*.html` incluindo o temporário `p1_capa.html.injected.html`.

**Sintoma**: na segunda iteração do loop, `renderHtmlToPdf(page, p1_capa.html.injected.html, theme)` falha com `ENOENT` ou renderiza página duplicada (e o validate-pptx conta 12 slides em vez de 8).

**Fix** (já aplicado em `engine/compose-pptx-v2.js`):
```javascript
const files = fs.readdirSync(pagesDir)
  .filter(f => /^p\d+_.+\.html$/.test(f) && !f.endsWith('.injected.html'))
  .sort(...);
```

## 🟡 WORKAROUND: Setar viewport ANTES e DEPOIS de setContent

**Problema**: `page.setContent()` pode resetar o viewport. O Chromium usa o viewport pra calcular o page size, então se o viewport virar 1280x720 (default), o PDF sai 1280x720 mesmo com `width: 13.333in`.

**Fix** (já aplicado):
```javascript
await page.setViewportSize({ width: 1280, height: 720 });  // ANTES
await page.setContent(injectedHtml, ...);
await page.setViewportSize({ width: 1280, height: 720 });  // DEPOIS (re-seta)
```

## 🟡 Otimização: tamanho do PPTX

| Cenário | Tamanho típico | Compressão |
|---|---|---|
| 8 slides, sem bg image | 50-200KB | - |
| 8 slides, 1-2 bg images (JPG) | 200KB-1MB | - |
| 8 slides, 3+ bg images (PNG) | 2-3MB | Converter PNG→JPG qualidade 88 (-90%) |

**Recomendação**: usar JPG para bg images, manter PNG só para logos com transparência, SVG para ícones.

## 🟡 CHECKLIST: Antes de gerar PPTX

1. ✅ `npm install` foi rodado? (deps: dom-to-pptx + adm-zip + playwright)
2. ✅ `.gitignore` existe com `node_modules/`, `*.log`, `*.tmp`, `build/`, `*.injected.html`?
3. ✅ `node scripts/patch-dom-to-pptx.js` foi rodado? (SEMPRE após npm install)
4. ✅ Cada página tem `<div class="page-slide">`?
5. ✅ CSS path é inline (não `<link>`)?
6. ✅ BG images são JPG < 500KB (ou PNG transparente se necessário)?
7. ✅ Font-sizes 30-50% maiores que A4?
8. ✅ Layout horizontal (ROW) em vez de vertical (GRID 2x2)?
9. ✅ Hero full-width com bg image (se aplicável)?
10. ✅ Pills/CTAs bem espaçadas horizontalmente?
11. ✅ Wrap não duplica slides (verificado: validate-pptx reporta N esperado, não 2N)?
12. ✅ API programática passa `width: 13.333, height: 7.5` (não slideWidth/slideHeight)?
13. ✅ Metadata (title/author) passada via `pptxOptions`?
14. ✅ Validação visual foi feita (abrir no PowerPoint)?

**Validação programática ANTES de distribuir** (workflow atualizado 2026-06-26):

```bash
# 1. Validação estrutural custom
node engine/validate-pptx-deep.js <arquivo.pptx>

# 2. NOVO (2026-06-26): validação de integridade OOXML — pega phantom Content_Types Overrides
node scripts/check-pptx-integrity.js <arquivo.pptx>
# Exit 0 = OK, exit 1 = problemas

# 3. Ground truth: python-pptx abre?
python3 -c "from pptx import Presentation; prs = Presentation('<arquivo.pptx>'); print(f'✓ {len(prs.slides)} slides')"
# Se não levantar exceção, PowerPoint aceita

# 4. Gerar PDF pra preview visual (LibreOffice unreliable, mas útil pra checar contagem)
libreoffice --headless --convert-to pdf --outdir /tmp/preview <arquivo.pptx>
pdftoppm -png -r 80 /tmp/preview/<doc>.pdf /tmp/preview/slide
ls /tmp/preview/*.png | wc -l  # deve bater com número de slides
```

Se step 1-3 OK mas PowerPoint abre com erro, ver `references/troubleshooting.md` seção "Bug 6".

## 🟢 BOAS PRÁTICAS

- **Cada slide ÚNICA**: nada de templates, LLM compõe do zero com layouts 16:9
- **Font-sizes SEMPRE via classes** (`.heading-1`, `.body`, `.caption`), nunca inline
- **Composição por página**: cards em ROW horizontal, split 60/40 wide, hero full-width
- **Validação**: `checkOverflow` do compose + `validate-pptx-deep.js` (16:9, ZIP, OOXML, imagens)
- **4+ rounds de iteração**: silence != approval
- **Logo ENS em TODA página** (footer com opacity 0.5)
- **Page number em TODA página** ("03 / 08")
- **2 botões CTA lado a lado** no CTA final (não 1 botão só)
- **Heurística de validação visual**: abra no PowerPoint. Se o slide parece "vazio" ou conteúdo ancorado num canto, é bug de composição.
- **Usar `lucide-static`** ao invés do ClawHub `icon` (1982 ícones SVG, npm oficial)

## 🟢 DECISÃO ARQUITETURAL: por que dom-to-pptx (vs alternativas)

| Alternativa | Prós | Contras | Veredito |
|---|---|---|---|
| **dom-to-pptx + PptxGenJS** | Preserva CSS moderno (gradients, flex, shadows) como shapes nativos. Editáveis. Open source. | Dep externa, bug SVG className. | ✅ **Escolhido** |
| PptxGenJS puro | API simples, confiável. | Não suporta CSS moderno. Texto em coordenadas absolutas, não funciona com HTML. | ❌ Layout espremido |
| HTML→PDF→PPTX via LibreOffice | Visual 1:1, fácil. | Gera imagens estáticas (não editáveis). Texto vira imagem. | ❌ Não-editável |
| Marp / reveal.js | Conversão rápida. | Markdown limitado, sem controle fino de layout. | ❌ Limitado |

**dom-to-pptx é a melhor opção pra preservar HTML/CSS como PPTX editável**. Único problema conhecido é o SVG className (patcheável).

## 🟢 Skill irmã: pdf-studio

Para PDFs A4/A5, use `pdf-studio` (em `/opt/data/skills/marketing/pdf-studio/`). Engine: Playwright + pdf-lib. Mesmo conteúdo visual mas layout A4/A5.

**Como se relacionam**:
- Mesmo `theme.js` (modality → CSS variables)
- Mesmas `primitives/` (CSS semântico)
- Mesma brandbook (5 cores ENS)
- Mesma logo (SVG inline `currentColor`)
- **Engine DIFERENTE** (pdf-studio: Playwright+pdf-lib / pptx-studio: dom-to-pptx+PptxGenJS)
- **Estrutura HTML DIFERENTE** (`.page-a4` vs `.page-slide`)
- **Composição DIFERENTE** (vertical vs horizontal, font-sizes 30-50% maiores)

## 🔗 Skills relacionadas

- `pdf-studio` (skill irmã, mesmo conteúdo em PDF A4/A5)
- `ens-marketing-copy` (copy validada)
- `ens-marketing-brief` (brief estruturado)
- `ens-system-audit` (auditoria do sistema ENS)
- `image-generation` (gpt-image-2 para bg images)
- `ens-skill-curation` (gestão do catálogo de skills)

## 📚 Onde encontrar mais

- `engine/compose-pptx-v2.js` — pipeline completo
- `engine/validate-pptx-deep.js` — validação estrutural
- `engine/theme.js` — modality → CSS variables (mesmo do pdf-studio)
- `scripts/patch-dom-to-pptx.js` — patch SVG className (CRÍTICO)
- `references/arsenal/` — composition, icons, patterns, bg-prompts
