/**
 * build-css.js — Compila primitives/input.css em primitives/dist/styles.css
 *
 * Por que o pptx-studio tem CSS próprio: o dom-to-pptx precisa do CSS
 * compilado (sem comments) injetado inline no HTML pra gerar o PPTX
 * corretamente.
 */

const fs = require('fs');
const path = require('path');

const INPUT = path.join(__dirname, '..', 'primitives', 'input.css');
const OUTPUT = path.join(__dirname, '..', 'primitives', 'dist', 'styles.css');

function build() {
  if (!fs.existsSync(INPUT)) {
    console.error('Input não encontrado: ' + INPUT);
    console.error('Crie primitives/input.css primeiro.');
    process.exit(1);
  }
  let css = fs.readFileSync(INPUT, 'utf8');
  // Remove /* ... */ comments
  css = css.replace(/\/\*[\s\S]*?\*\//g, ' ');
  // Collapse whitespace
  css = css.replace(/\s+/g, ' ');
  css = css.replace(/\s*\{\s*/g, '{');
  css = css.replace(/\s*\}\s*/g, '}');
  css = css.replace(/\s*:\s*/g, ':');
  css = css.replace(/\s*;\s*/g, ';');
  css = css.replace(/\s*,\s*/g, ',');
  css = css.trim();
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, css);
  const size = fs.statSync(OUTPUT).size;
  console.log(`CSS compiled: ${INPUT} -> ${OUTPUT} (${size} bytes, ${(size/1024).toFixed(1)}KB)`);
}

if (require.main === module) {
  build();
}

module.exports = { build };
