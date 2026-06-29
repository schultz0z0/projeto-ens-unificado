// compose-hybrid.js — gera slides 1 e 10 via pptxgenjs puro (com background image)
// e junta com slides 2-9 do dom-to-pptx

const fs = require('fs');
const path = require('path');
const PptxGenJS = require('pptxgenjs');

const project = 'gestao_seguros_em_2026';
const pagesDir = path.join(__dirname, '..', 'pages', project);
const assetsDir = path.join(pagesDir, 'assets');
const outDir = process.argv[2];
const finalName = process.argv[3] || 'Gestao_Seguros_Apresentacao_Escolas_2026';

if (!outDir) {
  console.error('Uso: node engine/compose-hybrid.js <out-dir> <name>');
  process.exit(1);
}

const pptx = new PptxGenJS();
pptx.layout = 'LAYOUT_WIDE'; // 13.333x7.5
pptx.title = 'Graduação em Gestão de Seguros — Apresentação para Escolas';
pptx.author = 'ENS · Escola de Negócios e Seguros';
pptx.company = 'ENS';
pptx.subject = 'ENS · Escola de Negócios e Seguros';

const CAPA_BG = path.join(assetsDir, 'capa_hero.png');
const ORANGE = 'F57222';
const TEAL = '005563';
const INK = '1A1A1A';
const INK_SOFT = '4A4A4A';
const WHITE = 'FFFFFF';

// ===== SLIDE 1: CAPA =====
const s1 = pptx.addSlide();
s1.background = { path: CAPA_BG };
// Overlay retângulo teal 90%
s1.addShape('rect', { x: 0, y: 0, w: 13.333, h: 7.5, fill: { color: TEAL, transparency: 10 }, line: { type: 'none' } });
// Logo ENS topo
s1.addText([
  { text: 'ENS', options: { fontSize: 22, bold: true, color: WHITE, charSpacing: 3 } },
  { text: '\nEscola de Negócios e Seguros', options: { fontSize: 12, color: 'DDEEEE', charSpacing: 1.5 } }
], {
  x: 0, y: 0.5, w: 13.333, h: 0.7, align: 'center', valign: 'middle',
  fontFace: 'Outfit'
});
// Eyebrow
s1.addText('GRADUAÇÃO · APRESENTAÇÃO PARA ESCOLAS', {
  x: 0, y: 1.6, w: 13.333, h: 0.3, align: 'center', valign: 'middle',
  fontFace: 'Outfit', fontSize: 14, bold: true, color: ORANGE, charSpacing: 4
});
// Linha accent laranja
s1.addShape('rect', { x: 6.4, y: 2.05, w: 0.55, h: 0.04, fill: { color: ORANGE }, line: { type: 'none' } });
// Headline (em 2 blocos para evitar autofit problemático)
s1.addText('Sua carreira começa agora.', {
  x: 0.5, y: 2.3, w: 12.333, h: 1.0, align: 'center', valign: 'middle',
  fontFace: 'Outfit', fontSize: 72, bold: true, color: WHITE, charSpacing: -2.5
});
s1.addText('Gestão de Seguros.', {
  x: 0.5, y: 3.3, w: 12.333, h: 1.0, align: 'center', valign: 'middle',
  fontFace: 'Outfit', fontSize: 72, bold: true, color: WHITE, charSpacing: -2.5
});
// Linha accent
s1.addShape('rect', { x: 6.4, y: 4.45, w: 0.55, h: 0.04, fill: { color: ORANGE }, line: { type: 'none' } });
// Subhead
s1.addText('A graduação tecnológica de 2 anos que forma os profissionais que o mercado de seguros mais procura.', {
  x: 1.5, y: 4.65, w: 10.333, h: 0.7, align: 'center', valign: 'middle',
  fontFace: 'Outfit', fontSize: 20, color: WHITE
});
// Pills
const pills = ['ENS · 50 ANOS', '100% ONLINE', '2 ANOS'];
const pillW = 1.9, pillH = 0.45, pillGap = 0.15;
const totalW = pills.length * pillW + (pills.length - 1) * pillGap;
const pillStartX = (13.333 - totalW) / 2;
pills.forEach((label, i) => {
  s1.addShape('roundRect', {
    x: pillStartX + i * (pillW + pillGap), y: 5.85, w: pillW, h: pillH,
    fill: { color: WHITE, transparency: 80 }, line: { color: WHITE, width: 1, transparency: 60 },
    rectRadius: 0.225
  });
  s1.addText(label, {
    x: pillStartX + i * (pillW + pillGap), y: 5.85, w: pillW, h: pillH, align: 'center', valign: 'middle',
    fontFace: 'Outfit', fontSize: 13, bold: true, color: WHITE, charSpacing: 2
  });
});
// Footer
s1.addText('ENS · Escola de Negócios e Seguros', {
  x: 0.5, y: 7.0, w: 6, h: 0.3, fontFace: 'Outfit', fontSize: 11, color: 'DDEEEE', bold: true
});
s1.addText('2026', {
  x: 11, y: 7.0, w: 2, h: 0.3, align: 'right', fontFace: 'Outfit', fontSize: 11, color: 'DDEEEE', bold: true
});

// ===== SLIDE 10: ENCERRAMENTO =====
const s10 = pptx.addSlide();
s10.background = { path: CAPA_BG };
// Overlay laranja 93%
s10.addShape('rect', { x: 0, y: 0, w: 13.333, h: 7.5, fill: { color: ORANGE, transparency: 7 }, line: { type: 'none' } });
// Logo ENS topo
s10.addText([
  { text: 'ENS', options: { fontSize: 22, bold: true, color: WHITE, charSpacing: 3 } },
  { text: '\nEscola de Negócios e Seguros', options: { fontSize: 12, color: 'FFEEDD', charSpacing: 1.5 } }
], {
  x: 0, y: 0.5, w: 13.333, h: 0.7, align: 'center', valign: 'middle',
  fontFace: 'Outfit'
});
// Eyebrow
s10.addText('PRÓXIMO PASSO', {
  x: 0, y: 1.5, w: 13.333, h: 0.3, align: 'center', valign: 'middle',
  fontFace: 'Outfit', fontSize: 14, bold: true, color: WHITE, charSpacing: 4
});
// Linha accent branca
s10.addShape('rect', { x: 6.4, y: 1.95, w: 0.55, h: 0.04, fill: { color: WHITE }, line: { type: 'none' } });
// Headline gigante
s10.addText('Tá esperando o quê?', {
  x: 0.5, y: 2.2, w: 12.333, h: 1.6, align: 'center', valign: 'middle',
  fontFace: 'Outfit', fontSize: 96, bold: true, color: WHITE, charSpacing: -3
});
// Subhead
s10.addText('Garanta sua vaga na Graduação em Gestão de Seguros da ENS.', {
  x: 1.5, y: 3.95, w: 10.333, h: 0.6, align: 'center', valign: 'middle',
  fontFace: 'Outfit', fontSize: 26, bold: true, color: WHITE
});
// Bloco contato (3 cards)
const contacts = [
  { label: 'e-mail', value: 'vestibular@ens.edu.br' },
  { label: 'site', value: 'ens.edu.br/graduacao' },
  { label: 'início das aulas', value: '03 de agosto' }
];
const cardW = 4.1, cardH = 1.4, cardGap = 0.25;
const cardStartX = (13.333 - (contacts.length * cardW + (contacts.length - 1) * cardGap)) / 2;
contacts.forEach((c, i) => {
  s10.addShape('roundRect', {
    x: cardStartX + i * (cardW + cardGap), y: 5.0, w: cardW, h: cardH,
    fill: { color: WHITE, transparency: 85 }, line: { color: WHITE, width: 1, transparency: 60 },
    rectRadius: 0.12
  });
  s10.addText(c.label.toUpperCase(), {
    x: cardStartX + i * (cardW + cardGap) + 0.25, y: 5.15, w: cardW - 0.5, h: 0.3,
    fontFace: 'Outfit', fontSize: 11, bold: true, color: 'FFEEDD', charSpacing: 2
  });
  s10.addText(c.value, {
    x: cardStartX + i * (cardW + cardGap) + 0.25, y: 5.5, w: cardW - 0.5, h: 0.6,
    fontFace: 'Outfit', fontSize: 22, bold: true, color: WHITE
  });
});
// Footer
s10.addText('ENS · 50 ANOS FORMANDO OS LÍDERES DO SEGURO', {
  x: 0.5, y: 7.0, w: 8, h: 0.3, fontFace: 'Outfit', fontSize: 12, color: 'FFFFFF', bold: true, charSpacing: 1.5
});
s10.addText('10 / 10', {
  x: 11, y: 7.0, w: 2, h: 0.3, align: 'right', fontFace: 'Outfit', fontSize: 11, color: 'FFEEDD', bold: true
});

// Salva
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, finalName + '.pptx');
pptx.writeFile({ fileName: outPath }).then(p => {
  console.log('OK:', p);
  console.log('  size:', fs.statSync(outPath).size, 'bytes');
}).catch(e => {
  console.error('Erro:', e.message);
  process.exit(1);
});