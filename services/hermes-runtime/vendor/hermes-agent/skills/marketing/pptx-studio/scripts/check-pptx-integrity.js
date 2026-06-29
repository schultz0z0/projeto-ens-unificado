#!/usr/bin/env node
// check-pptx-integrity.js — Valida integridade OOXML de qualquer PPTX
//
// Verifica 4 classes de problemas que `validate-pptx-deep.js` NÃO pega:
//   1. Content_Types.xml tem <Override PartName="X"> onde X não existe no zip
//      (PowerPoint falha com "O PowerPoint não pode ler ...")
//   2. presentation.xml.rels tem Target="X" que não existe no zip
//   3. sldIdLst rIds que não existem em presentation.xml.rels
//   4. Slide rels (.rels) com Target="../media/X" onde X não está em ppt/media/
//
// Uso: node scripts/check-pptx-integrity.js <arquivo.pptx>
// Exit 0 = OK, Exit 1 = problemas encontrados
//
// Recriado 2026-06-26 após Raphael reportar "O PowerPoint não pode ler
// C:\\...\\Gestao_Seguros_Apresentacao_Escolas_2026.pptx" — bug veio de
// merge adm-zip que deixou 9 entradas <Override PartName="slideMaster2..10">
// no Content_Types sem os arquivos correspondentes.

const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

const pptxPath = process.argv[2];
if (!pptxPath) {
  console.error('Uso: node scripts/check-pptx-integrity.js <arquivo.pptx>');
  process.exit(2);
}

if (!fs.existsSync(pptxPath)) {
  console.error(`Arquivo não encontrado: ${pptxPath}`);
  process.exit(2);
}

const zip = new AdmZip(pptxPath);
const names = zip.getEntries().filter(e => !e.isDirectory).map(e => e.entryName);
const nameSet = new Set(names);

const issues = [];
let checked = 0;

function check(label, ok, detail) {
  checked++;
  if (ok) {
    console.log(`  ✓ ${label}`);
  } else {
    console.log(`  ✗ ${label} — ${detail}`);
    issues.push(`${label}: ${detail}`);
  }
}

// --- 1. Content_Types Override entries ---
console.log('\n[1] Content_Types.xml — Overrides vs arquivos reais');
const ct = zip.readAsText('[Content_Types].xml');
const overrides = [...ct.matchAll(/<Override PartName="([^"]+)"\s+ContentType="([^"]+)"/g)];
let overridesOk = 0;
for (const m of overrides) {
  const partname = m[1].replace(/^\//, '');
  if (nameSet.has(partname)) {
    overridesOk++;
  } else {
    console.log(`    ✗ FANTASMA: ${partname} (${m[2]})`);
    issues.push(`Phantom Content_Types Override: ${partname}`);
  }
}
console.log(`    ${overridesOk}/${overrides.length} Overrides resolvem`);
check('Content_Types consistente', issues.filter(i => i.startsWith('Phantom Content_Types')).length === 0, '');

// --- 2. presentation.xml.rels Targets vs arquivos reais ---
console.log('\n[2] presentation.xml.rels — Targets vs arquivos reais');
const presRels = zip.readAsText('ppt/_rels/presentation.xml.rels');
const presTargets = [...presRels.matchAll(/Target="([^"]+)"/g)].map(m => m[1]);
let presOk = 0;
for (const t of presTargets) {
  let full;
  if (t.startsWith('../')) full = t.slice(3);
  else if (t.startsWith('/')) full = t.slice(1);
  else full = 'ppt/' + t;
  if (nameSet.has(full)) {
    presOk++;
  } else {
    console.log(`    ✗ Target ausente: ${t} → esperado ${full}`);
    issues.push(`presentation.xml.rels target missing: ${t}`);
  }
}
console.log(`    ${presOk}/${presTargets.length} Targets resolvem`);

// --- 3. sldIdLst rIds vs presentation.xml.rels ---
console.log('\n[3] presentation.xml sldIdLst rIds vs presentation.xml.rels');
const pres = zip.readAsText('ppt/presentation.xml');
const sldIdMatch = pres.match(/<p:sldIdLst>([\s\S]*?)<\/p:sldIdLst>/);
if (sldIdMatch) {
  const sldRids = [...sldIdMatch[1].matchAll(/r:id="(rId\d+)"/g)].map(m => m[1]);
  const relIds = new Set([...presRels.matchAll(/Id="(rId\d+)"/g)].map(m => m[1]));
  const missing = sldRids.filter(r => !relIds.has(r));
  if (missing.length === 0) {
    console.log(`    ✓ ${sldRids.length} slide rIds todos presentes em presentation.xml.rels`);
  } else {
    console.log(`    ✗ rIds ausentes: ${missing.join(', ')}`);
    issues.push(`sldIdLst rIds missing: ${missing.join(', ')}`);
  }
} else {
  console.log('    (sem sldIdLst)');
}

// --- 4. Slide rels → media files ---
console.log('\n[4] Slide rels — Target ../media/ vs arquivos reais');
const slideRels = names.filter(n => n.startsWith('ppt/slides/_rels/') && n.endsWith('.rels'));
let mediaOk = 0;
let mediaTotal = 0;
for (const rel of slideRels) {
  const c = zip.readAsText(rel);
  const mediaTargets = [...c.matchAll(/Target="(\.\.\/media\/[^"]+)"/g)].map(m => m[1]);
  for (const t of mediaTargets) {
    mediaTotal++;
    const full = t.replace('../', 'ppt/');
    if (nameSet.has(full)) {
      mediaOk++;
    } else {
      console.log(`    ✗ ${rel} → ${t} ausente`);
      issues.push(`Slide rels media missing: ${rel} → ${t}`);
    }
  }
}
console.log(`    ${mediaOk}/${mediaTotal} referências de media resolvem`);

// --- Sumário ---
console.log('\n=== SUMÁRIO ===');
if (issues.length === 0) {
  console.log(`✓ ${checked} verificações passaram. PPTX íntegro.`);
  process.exit(0);
} else {
  console.log(`✗ ${issues.length} problemas encontrados:`);
  for (const i of issues) console.log(`  - ${i}`);
  process.exit(1);
}
