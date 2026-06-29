/**
 * compose-pptx-v2.js — Engine de geração de PPTX 16:9 usando dom-to-pptx
 *
 * Estratégia: cada página HTML do projeto (pages/<projeto>/p<N>_*.html) é
 * envelopada em .slide, com paths absolutos pra CSS e assets, e então
 * processada via dom-to-pptx que:
 * 1. Lê DOM via Puppeteer/Chromium
 * 2. Calcula layout Flexbox/Grid
 * 3. Converte CSS (gradients, shadows, border-radius) pra shapes PPTX
 * 4. Embute fontes e imagens
 * 5. Gera PPTX real (editável, shapes nativos)
 *
 * Saída: <output>.pptx com 1 slide por página HTML
 *
 * Uso: node engine/compose-pptx-v2.js --project <name> --out-dir <dir> --name <doc> [--kv <json>]
 *
 * Deps: dom-to-pptx@^2.0.1 (instala puppeteer + pptxgenjs + jszip)
 * IMPORTANTE: após `npm install`, rode `node scripts/patch-dom-to-pptx.js` pra
 * aplicar patch SVG no bundle (senão falha com SVG inline).
 */

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
function getArg(flag, def) {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : def;
}
const project = getArg('--project');
const outDir = getArg('--out-dir');
const name = getArg('--name', 'document');
const kvJson = getArg('--kv', null);

if (!project || !outDir) {
  console.error('Uso: node engine/compose-pptx-v2.js --project <name> --out-dir <dir> --name <doc> [--kv <json>]');
  process.exit(1);
}

const { buildTheme } = require('./theme.js');
let kv = {};
if (kvJson) {
  try { kv = JSON.parse(kvJson); } catch (e) {
    console.error('KV inválido: ' + e.message);
    process.exit(1);
  }
}
kv.format = 'slide';

const theme = buildTheme(kv);
const pagesDir = path.join(__dirname, '..', 'pages', project);

if (!fs.existsSync(pagesDir)) {
  console.error('Diretório de páginas não existe: ' + pagesDir);
  process.exit(1);
}

const files = fs.readdirSync(pagesDir)
  .filter(f => /^p\d+_.+\.html$/.test(f))
  .sort((a, b) => {
    const na = parseInt(a.match(/^p(\d+)/)[1], 10);
    const nb = parseInt(b.match(/^p(\d+)/)[1], 10);
    return na - nb;
  });

if (files.length === 0) {
  console.error('Nenhuma página encontrada em ' + pagesDir);
  process.exit(1);
}

console.log('========================================');
console.log('Nexus Studio v3.2 — compose-pptx-v2 (dom-to-pptx)');
console.log('  project:  ' + project);
console.log('  output:   PPTX 16:9 (1280x720) via dom-to-pptx');
console.log('  modality: ' + (theme.modality || '(default)'));
console.log('  primary:  ' + theme.primary);
console.log('  pages:    ' + files.length);
console.log('========================================');

const ABS_BASE = path.resolve(__dirname, '..');

function wrapAsSlide(htmlPath) {
  let html = fs.readFileSync(htmlPath, 'utf8');
  const themeStyle = theme.toCssVars();
  if (html.includes('<head>')) {
    html = html.replace('<head>', `<head>\n<style id="theme-vars">\n${themeStyle}</style>`);
  }
  html = html.replace(/src="assets\//g, `src="file://${path.join(pagesDir, 'assets')}/`);
  html = html.replace(/href="\.\.\/\.\.\/primitives\//g, `href="file://${path.join(ABS_BASE, 'primitives')}/`);

  // Extrai SÓ o conteúdo do <body> (sem <!DOCTYPE>, <html>, <head>)
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  let bodyContent = bodyMatch ? bodyMatch[1] : html;

  // Se body já tem <div class="slide"> envolvente, extrai o conteúdo INTERNO
  const slideMatch = bodyContent.match(/<div class="slide"[^>]*>([\s\S]*?)<\/div>\s*$/i);
  if (slideMatch) {
    bodyContent = slideMatch[1];
  }

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <link rel="stylesheet" href="file://${path.join(ABS_BASE, 'primitives/dist/styles.css')}">
  <style>
    .page-a4, .page-a5, .page-slide { width: 13.333in !important; height: 7.5in !important; }
    body { margin: 0; padding: 0; }
  </style>
</head>
<body>
  <div class="slide">
    ${bodyContent}
  </div>
</body>
</html>
`;
}

const tmpDir = `/tmp/pptx-v2-${project}-${Date.now()}`;
fs.mkdirSync(tmpDir, { recursive: true });

for (const f of files) {
  const wrapped = wrapAsSlide(path.join(pagesDir, f));
  fs.writeFileSync(path.join(tmpDir, f), wrapped);
}
console.log(`  Wrappers criados em ${tmpDir}/`);

const combinedHtml = files.map(f => wrapAsSlide(path.join(pagesDir, f))).join('\n');
const combinedPath = path.join(tmpDir, 'all-slides.html');
fs.writeFileSync(combinedPath, combinedHtml);
console.log(`  Combined HTML: ${combinedPath}`);

let exportHtmlToPptx;
try {
  ({ exportHtmlToPptx } = require('dom-to-pptx/node'));
} catch (e) {
  console.error('Erro ao carregar dom-to-pptx/node:', e.message);
  console.error('Instale: npm install dom-to-pptx --ignore-scripts');
  process.exit(1);
}

(async () => {
  try {
    console.log('\n  Renderizando via dom-to-pptx (Chromium headless)...');
    const buffer = await exportHtmlToPptx(combinedPath, {
      selector: '.slide',
      injectBundle: true,
      pptxOptions: {
        width: 13.333,
        height: 7.5,
        title: kv.title || name,
        author: kv.author || 'ENS',
        company: 'ENS',
        subject: kv.subject || 'Nexus Studio PPTX',
      },
    });

    fs.mkdirSync(outDir, { recursive: true });
    const outPath = path.join(outDir, name + '.pptx');
    fs.writeFileSync(outPath, buffer);

    const size = fs.statSync(outPath).size;
    console.log('\n========================================');
    console.log('PPTX_OK ' + outPath);
    console.log('  size:   ' + (size / 1024).toFixed(1) + 'KB');
    console.log('  pages:  ' + files.length);
    console.log('  format: PPTX 16:9 (1280x720) via dom-to-pptx');
    console.log('========================================');

    fs.rmSync(tmpDir, { recursive: true });
  } catch (e) {
    console.error('ERRO:', e.message);
    if (e.stack) console.error(e.stack);
    process.exit(1);
  }
})();
