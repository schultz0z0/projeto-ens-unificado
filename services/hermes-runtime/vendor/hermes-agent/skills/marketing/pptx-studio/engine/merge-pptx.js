// merge-pptx.js — junta cover_only (slide 1+10) com body_only (slides 2-9)
// usando adm-zip (sync). Versão corrigida.

const fs = require('fs');
const path = require('path');
const AdmZip = require(path.join(__dirname, '..', 'node_modules', 'adm-zip'));

const coverPath = '/tmp/cover_only.pptx';
const bodyPath = '/tmp/body_only.pptx';
const outPath = '/opt/data/ens_presentations/Gestao_Seguros_Apresentacao_Escolas_2026.pptx';

const coverZip = new AdmZip(coverPath);
const bodyZip = new AdmZip(bodyPath);

// bodyZip entries (sync)
const bodyEntries = {};
bodyZip.getEntries().forEach(e => {
  if (!e.isDirectory) bodyEntries[e.entryName] = e.getData();
});

const coverEntries = {};
coverZip.getEntries().forEach(e => {
  if (!e.isDirectory) coverEntries[e.entryName] = e.getData();
});

// Start with body entries
const outEntries = {};
for (const [name, data] of Object.entries(bodyEntries)) {
  // Skip body slide1 (we replace with cover slide1)
  if (name === 'ppt/slides/slide1.xml' || name === 'ppt/slides/_rels/slide1.xml.rels') continue;
  // Rename body slide 2..8 -> slide 3..9
  const m = name.match(/^ppt\/slides\/slide(\d+)\.xml$/);
  if (m) {
    const n = parseInt(m[1]);
    if (n >= 3 && n <= 8) {
      outEntries[`ppt/slides/slide${n + 1}.xml`] = data;
      continue;
    }
    if (n === 2) {
      outEntries[`ppt/slides/slide2.xml`] = data;
      continue;
    }
  }
  const m2 = name.match(/^ppt\/slides\/_rels\/slide(\d+)\.xml\.rels$/);
  if (m2) {
    const n = parseInt(m2[1]);
    if (n >= 3 && n <= 8) {
      outEntries[`ppt/slides/_rels/slide${n + 1}.xml.rels`] = data;
      continue;
    }
    if (n === 1) continue;
    if (n === 2) {
      outEntries[`ppt/slides/_rels/slide2.xml.rels`] = data;
      continue;
    }
  }
  outEntries[name] = data;
}

// Add cover slide1.xml and slide10.xml
outEntries['ppt/slides/slide1.xml'] = coverEntries['ppt/slides/slide1.xml'];
outEntries['ppt/slides/slide10.xml'] = coverEntries['ppt/slides/slide2.xml'];
outEntries['ppt/slides/_rels/slide1.xml.rels'] = coverEntries['ppt/slides/_rels/slide1.xml.rels'];
outEntries['ppt/slides/_rels/slide10.xml.rels'] = coverEntries['ppt/slides/_rels/slide2.xml.rels'];

// Find max image number in body
let maxBodyImg = 0;
for (const name of Object.keys(bodyEntries)) {
  const m = name.match(/^ppt\/media\/image-(\d+)\./);
  if (m) maxBodyImg = Math.max(maxBodyImg, parseInt(m[1]));
}
const newImg1 = maxBodyImg + 1;
const newImg2 = maxBodyImg + 2;

// Find cover media images (they're image-1-1.png and image-2-1.png in cover)
const coverImgs = Object.keys(coverEntries).filter(n => /^ppt\/media\/image-\d+-\d+\.(png|jpg|jpeg)$/i.test(n)).sort();
// coverImgs[0] should be capa, [1] should be encerramento
if (coverImgs.length >= 2) {
  outEntries[`ppt/media/image-${newImg1}.png`] = coverEntries[coverImgs[0]];
  outEntries[`ppt/media/image-${newImg2}.png`] = coverEntries[coverImgs[1]];
}

// Patch slide1.xml.rels: replace image-1-1.png with image-N.png
let s1RelsStr = outEntries['ppt/slides/_rels/slide1.xml.rels'].toString('utf8');
s1RelsStr = s1RelsStr.replace(/image-1-1\.png/g, `image-${newImg1}.png`);
outEntries['ppt/slides/_rels/slide1.xml.rels'] = Buffer.from(s1RelsStr);

let s10RelsStr = outEntries['ppt/slides/_rels/slide10.xml.rels'].toString('utf8');
s10RelsStr = s10RelsStr.replace(/image-2-1\.png/g, `image-${newImg2}.png`);
outEntries['ppt/slides/_rels/slide10.xml.rels'] = Buffer.from(s10RelsStr);

// Update presentation.xml.rels: add rIds for slide1 and slide10
let presRels = outEntries['ppt/_rels/presentation.xml.rels'].toString('utf8');
const rIdMatches = [...presRels.matchAll(/Id="rId(\d+)"/g)].map(m => parseInt(m[1]));
const maxRId = Math.max(...rIdMatches, 0);
const newRId1 = maxRId + 1;
const newRId10 = maxRId + 2;
const newRel1 = `<Relationship Id="rId${newRId1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/>`;
const newRel10 = `<Relationship Id="rId${newRId10}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide10.xml"/>`;
presRels = presRels.replace('</Relationships>', newRel1 + newRel10 + '</Relationships>');
outEntries['ppt/_rels/presentation.xml.rels'] = Buffer.from(presRels);

// Update presentation.xml: replace sldIdLst with 10-entry list
let presXml = outEntries['ppt/presentation.xml'].toString('utf8');
const existingList = presXml.match(/<p:sldIdLst>(.*?)<\/p:sldIdLst>/s);
if (!existingList) { console.error('No sldIdLst'); process.exit(1); }
const innerRIds = [...existingList[1].matchAll(/r:id="rId(\d+)"/g)].map(m => parseInt(m[1]));
const slideIds = [...presXml.matchAll(/<p:sldId id="(\d+)"/g)].map(m => parseInt(m[1]));
const maxSlideId = Math.max(...slideIds, 255);
let nextId = maxSlideId + 1;
let newListXml = `<p:sldIdLst><p:sldId id="${nextId++}" r:id="rId${newRId1}"/>`;
for (const rIdNum of innerRIds) {
  newListXml += `<p:sldId id="${nextId++}" r:id="rId${rIdNum}"/>`;
}
newListXml += `<p:sldId id="${nextId++}" r:id="rId${newRId10}"/></p:sldIdLst>`;
presXml = presXml.replace(/<p:sldIdLst>.*?<\/p:sldIdLst>/s, newListXml);
outEntries['ppt/presentation.xml'] = Buffer.from(presXml);

// Update [Content_Types].xml
let ctXml = outEntries['[Content_Types].xml'].toString('utf8');
const slide10Override = `<Override PartName="/ppt/slides/slide10.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`;
if (!ctXml.includes('slide10.xml')) {
  ctXml = ctXml.replace('</Types>', slide10Override + '</Types>');
}
outEntries['[Content_Types].xml'] = Buffer.from(ctXml);

// Write new zip
const outZip = new AdmZip();
for (const [name, data] of Object.entries(outEntries)) {
  outZip.addFile(name, data);
}
fs.mkdirSync(path.dirname(outPath), { recursive: true });
outZip.writeZip(outPath);
console.log('Final PPTX:', outPath);
console.log('Size:', fs.statSync(outPath).size, 'bytes');