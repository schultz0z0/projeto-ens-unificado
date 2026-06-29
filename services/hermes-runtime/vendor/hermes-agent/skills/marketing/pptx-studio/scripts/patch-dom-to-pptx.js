#!/usr/bin/env node
/**
 * patch-dom-to-pptx.js — Aplica patches críticos no dom-to-pptx após npm install
 *
 * Patch: SVG className é SVGAnimatedString (não string). className.split() falha
 *        com "node.className.split is not a function". Patch: wrappar com
 *        String(... || "").split(...).
 *
 * Como rodar: node scripts/patch-dom-to-pptx.js
 *
 * Quando rodar: após `npm install dom-to-pptx` ou se você ver erro
 *               "Programmatic export failed: node.className.split is not a function"
 *
 * Por que não é upstream: dom-to-pptx é dep de terceiros. Se virar parte
 * oficial, remover este script. PR upstream sugerido.
 */

const fs = require('fs');
const path = require('path');

const PATCH_TARGETS = [
  'node_modules/dom-to-pptx/dist/dom-to-pptx.cjs',
  'node_modules/dom-to-pptx/dist/dom-to-pptx.bundle.js',
];

let totalPatched = 0;

for (const target of PATCH_TARGETS) {
  const fullPath = path.resolve(__dirname, '..', target);
  if (!fs.existsSync(fullPath)) {
    console.log(`  SKIP: ${target} (not found)`);
    continue;
  }

  let content = fs.readFileSync(fullPath, 'utf8');
  const hadPatch = content.includes('classNameStr') || content.includes('String(node.className');

  if (hadPatch) {
    console.log(`  ALREADY: ${target} (patch already applied)`);
    continue;
  }

  // Patch: substitui .className.split( por String(node.className || "").split(
  // Esta regex captura nomes de variáveis antes de .className.split
  const re = /(\b\w+)\.className\.split\(/g;
  const matches = content.match(re);
  if (!matches) {
    console.log(`  NOPATCH: ${target} (no .className.split() found)`);
    continue;
  }

  const patched = content.replace(re, 'String($1.className || "").split(');
  fs.writeFileSync(fullPath, patched);
  console.log(`  PATCHED: ${target} (${matches.length} occurrences)`);
  totalPatched++;
}

console.log(`\nTotal patched: ${totalPatched} file(s)`);
if (totalPatched > 0) {
  console.log('OK: dom-to-pptx is now SVG-safe.');
  console.log('NOTE: If you run `npm install` again, run this script again.');
}
