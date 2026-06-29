/**
 * validate-pptx.js — Validação simples de PPTX (estrutura + 16:9)
 *
 * Wrapper leve do validate-pptx-deep pra quem só quer validar estrutura.
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function validatePptx(pptxPath) {
  return spawnSync('node', [path.join(__dirname, 'validate-pptx-deep.js'), pptxPath], {
    encoding: 'utf-8',
  });
}

if (require.main === module) {
  if (process.argv.length < 3) {
    console.error('Uso: node engine/validate-pptx.js <arquivo.pptx>');
    process.exit(1);
  }
  const r = validatePptx(process.argv[2]);
  process.stdout.write(r.stdout || '');
  process.stderr.write(r.stderr || '');
  process.exit(r.status || 0);
}

module.exports = { validatePptx };
