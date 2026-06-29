/**
 * validate-pptx-deep.js — Validação profunda de PPTX
 * (Verifica estrutura, dimensões, imagens, textos)
 */

const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

function readZip(filePath) {
  const zip = new AdmZip(filePath);
  return zip.getEntries().map(e => ({ name: e.entryName, data: e.getData() }));
}

function getJpegDimensions(data) {
  if (data[0] !== 0xFF || data[1] !== 0xD8) return null;
  let i = 2;
  while (i < data.length) {
    if (data[i] === 0xFF) {
      const marker = data[i + 1];
      if (marker === 0xC0 || marker === 0xC2) {
        return { width: data.readUInt16BE(i + 5), height: data.readUInt16BE(i + 7) };
      }
      i += 2 + data.readUInt16BE(i + 2);
    } else { i++; }
  }
  return null;
}

function getPngDimensions(data) {
  if (data[0] !== 0x89 || data[1] !== 0x50) return null;
  return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
}

function getSvgDimensions(data) {
  const header = data.toString('utf-8', 0, Math.min(2000, data.length));
  const wMatch = header.match(/<svg[^>]*\swidth=["']?(\d+)/);
  const hMatch = header.match(/<svg[^>]*\sheight=["']?(\d+)/);
  if (wMatch && hMatch) {
    return { width: parseInt(wMatch[1]), height: parseInt(hMatch[1]), format: 'SVG' };
  }
  return { width: 0, height: 0, format: 'SVG' };
}

function validatePptxDeep(pptxPath) {
  const errors = [];
  const warnings = [];
  const info = {
    file: pptxPath,
    size: fs.statSync(pptxPath).size,
    slideCount: 0,
    imageCount: 0,
    imageTotalSize: 0,
    images: [],
    slideSize: null,
    metadata: {},
    texts: [],
    shapesPerSlide: [],
  };

  let entries;
  try { entries = readZip(pptxPath); }
  catch (e) { return { ok: false, errors: [`Não é ZIP válido: ${e.message}`], warnings, info }; }

  const required = ['[Content_Types].xml', '_rels/.rels', 'ppt/presentation.xml'];
  for (const f of required) {
    if (!entries.find(e => e.name === f)) errors.push(`Arquivo essencial faltando: ${f}`);
  }

  const slideFiles = entries.filter(e => /^ppt\/slides\/slide\d+\.xml$/.test(e.name));
  info.slideCount = slideFiles.length;
  if (info.slideCount === 0) errors.push('Nenhum slide encontrado');

  const presXml = entries.find(e => e.name === 'ppt/presentation.xml');
  const coreXml = entries.find(e => e.name === 'docProps/core.xml');
  if (presXml) {
    const content = presXml.data.toString('utf-8');
    const sizeMatch = content.match(/<p:sldSz\s+cx="(\d+)"\s+cy="(\d+)"/);
    if (sizeMatch) {
      const cx = parseInt(sizeMatch[1]);
      const cy = parseInt(sizeMatch[2]);
      info.slideSize = { cx, cy, widthInches: cx / 914400, heightInches: cy / 914400 };
      if (cx !== 12192000 || cy !== 6858000) {
        warnings.push(`Slide size não é 16:9 padrão. Atual: ${cx}x${cy} EMU (${info.slideSize.widthInches.toFixed(3)}x${info.slideSize.heightInches.toFixed(3)} inches).`);
      }
    } else { warnings.push('Tag <p:sldSz> não encontrada'); }
  }

  if (coreXml) {
    const c = coreXml.data.toString('utf-8');
    const title = c.match(/<dc:title>([^<]+)<\/dc:title>/);
    const creator = c.match(/<dc:creator>([^<]+)<\/dc:creator>/);
    if (title) info.metadata.title = title[1];
    if (creator) info.metadata.creator = creator[1];
  }

  const imageFiles = entries.filter(e => e.name.startsWith('ppt/media/') && !e.name.endsWith('/'))
    .filter(e => e.data && e.data.length > 0);
  info.imageCount = imageFiles.length;
  for (const img of imageFiles) {
    const data = img.data;
    info.imageTotalSize += data.length;
    const byte0 = data.readUInt8 ? data.readUInt8(0) : data[0];
    const byte1 = data.readUInt8 ? data.readUInt8(1) : data[1];
    const isJpg = byte0 === 0xFF && byte1 === 0xD8;
    const isPng = byte0 === 0x89 && byte1 === 0x50;
    const isSvg = byte0 === 0x3C && byte1 === 0x73;
    if (!isJpg && !isPng && !isSvg) {
      warnings.push(`${img.name}: formato não reconhecido`);
      continue;
    }
    let dims = isJpg ? getJpegDimensions(data) : isPng ? getPngDimensions(data) : getSvgDimensions(data);
    if (!dims || (dims.width === 0 && dims.height === 0)) {
      warnings.push(`${img.name}: não foi possível extrair dimensões`);
      continue;
    }
    info.images.push({
      name: img.name,
      format: isJpg ? 'JPEG' : isPng ? 'PNG' : 'SVG',
      width: dims.width,
      height: dims.height,
      sizeKB: Math.round(data.length / 1024),
    });
  }

  for (const slide of slideFiles) {
    const content = slide.data.toString('utf-8');
    const shapes = (content.match(/<p:sp>/g) || []).length;
    const pictures = (content.match(/<p:pic>/g) || []).length;
    info.shapesPerSlide.push({ slide: slide.name, shapes, pictures });
    const textMatches = content.match(/<a:t>([^<]+)<\/a:t>/g) || [];
    const texts = textMatches.map(t => t.replace(/<[^>]+>/g, '').trim()).filter(t => t.length > 0);
    info.texts.push(...texts.map(t => ({ slide: slide.name, text: t })));
  }

  for (const e of entries) {
    if (!e.name.endsWith('.xml') && !e.name.endsWith('.rels')) continue;
    const content = e.data.toString('utf-8');
    const openCount = (content.match(/<[a-zA-Z][^>]*[^/]>/g) || []).length;
    const closeCount = (content.match(/<\/[a-zA-Z][^>]*>/g) || []).length;
    if (openCount !== closeCount) {
      warnings.push(`${e.name}: tags abertas (${openCount}) vs fechadas (${closeCount}) não batem`);
    }
  }

  return { ok: errors.length === 0, critical: errors.length === 0, errors, warnings, info };
}

function printReport(result) {
  const i = result.info;
  console.log('========================================');
  console.log('pptx-studio v1.0 — validate-pptx-deep');
  console.log('========================================');
  console.log(`File:        ${i.file}`);
  console.log(`Size:        ${(i.size / 1024).toFixed(1)}KB`);
  console.log(`Slides:      ${i.slideCount}`);
  console.log(`Images:      ${i.imageCount} (${(i.imageTotalSize / 1024).toFixed(1)}KB total)`);
  if (i.slideSize) {
    console.log(`Slide size:  ${i.slideSize.cx}x${i.slideSize.cy} EMU = ${i.slideSize.widthInches.toFixed(3)}x${i.slideSize.heightInches.toFixed(3)} inches`);
  }
  console.log(`Metadata:    ${JSON.stringify(i.metadata)}`);
  console.log('');

  if (i.images.length > 0) {
    console.log('Imagens embedadas:');
    for (const img of i.images) {
      console.log(`  ${img.name}: ${img.format} ${img.width}x${img.height}px (${img.sizeKB}KB)`);
    }
    console.log('');
  }

  if (i.shapesPerSlide.length > 0) {
    console.log('Shapes por slide:');
    for (const s of i.shapesPerSlide) {
      console.log(`  ${s.slide}: ${s.shapes} shapes, ${s.pictures} pictures`);
    }
    console.log('');
  }

  if (i.texts.length > 0) {
    console.log(`Textos extraídos (${i.texts.length} total):`);
    for (const t of i.texts.slice(0, 8)) {
      console.log(`  [${t.slide}] "${t.text.substring(0, 80)}"`);
    }
    if (i.texts.length > 8) console.log(`  ... +${i.texts.length - 8} mais`);
    console.log('');
  }

  if (result.errors.length > 0) {
    console.log(`❌ ${result.errors.length} ERRO(S):`);
    for (const e of result.errors) console.log(`  • ${e}`);
  }
  if (result.warnings.length > 0) {
    console.log(`⚠️  ${result.warnings.length} warning(s):`);
    for (const w of result.warnings) console.log(`  • ${w}`);
  }
  if (result.ok && result.warnings.length === 0) {
    console.log('✓ PPTX OK — estrutura válida, conteúdo verificado, sem warnings.');
  } else if (result.ok) {
    console.log('✓ PPTX OK (com warnings) — usable.');
  }
  console.log('========================================');
}

if (process.argv.length < 3) {
  console.error('Uso: node engine/validate-pptx-deep.js <arquivo.pptx>');
  process.exit(1);
}

const result = validatePptxDeep(process.argv[2]);
printReport(result);
process.exit(result.ok ? (result.warnings.length > 0 ? 2 : 0) : 1);
