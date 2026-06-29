// compose-pptxgenjs-full.js — gera 10 slides PPTX 16:9 via pptxgenjs puro.
// v3 — correções visuais:
//   - Capa com overlay LARANJA (cor primária Graduação, não MBA)
//   - Slides 2-9 com fundo CREME #F4F1E1
//   - Logo ENS via PNG transparente (não texto)
//   - Slide 3: ícones SVG lucide (sem emojis) + cards subidos
//   - Slides 6/7: fotos croppadas (sem achatar)

const fs = require('fs');
const path = require('path');
const PptxGenJS = require('pptxgenjs');

const project = 'gestao_seguros_em_2026';
const pagesDir = path.join(__dirname, '..', 'pages', project);
const assetsDir = path.join(pagesDir, 'assets');
const outDir = process.argv[2] || '/opt/data/ens_presentations';
const outName = process.argv[3] || 'Gestao_Seguros_Apresentacao_Escolas_2026';

// === CORES ===
const ORANGE = 'F57222';        // primária Graduação
const TEAL = '005563';          // secundária (institucional)
const INK = '1A1A1A';
const INK_SOFT = '4A4A4A';
const WHITE = 'FFFFFF';
const CREAM = 'F4F1E1';         // fundo complementar
const CREAM_DARK = 'ECE7D2';    // hover/sombra
const PAPER = 'FEF6F1';         // ton claro laranja
const SURFACE = 'F2F4F5';

// === ASSETS ===
const CAPA_BG = path.join(assetsDir, 'capa_hero.png');
const CITY = path.join(assetsDir, 'city_sunrise.png');
const YOUNG_CROP = path.join(assetsDir, 'young_pro_crop.png');
const PORTRAIT_CROP = path.join(assetsDir, 'portrait_pro_crop.png');
const DESK = path.join(assetsDir, 'desk_charts.png');
const LOGO_WHITE = path.join(assetsDir, 'ens_logo_white.png');
const LOGO_BLUE = path.join(assetsDir, 'ens_logo_blue.png');

// Logo aspect: 512x105 = 4.876:1
const LOGO_W = 2.5; // inches (24% of slide width)
const LOGO_H = LOGO_W / 4.876;

const pptx = new PptxGenJS();
pptx.layout = 'LAYOUT_WIDE';
pptx.title = 'Graduação em Gestão de Seguros — Apresentação para Escolas';
pptx.author = 'ENS · Escola de Negócios e Seguros';
pptx.company = 'ENS';
pptx.subject = 'ENS · Escola de Negócios e Seguros';

// ===== Helper: logo ENS topo via PNG transparente =====
function addLogoWhite(s, w = LOGO_W) {
  const h = w / 4.876;
  s.addImage({ path: LOGO_WHITE, x: (13.333 - w) / 2, y: 0.4, w, h });
}
function addLogoBlue(s, w = 1.4) {
  const h = w / 4.876;
  // Use on cream slides (top-left small mark)
  s.addImage({ path: LOGO_BLUE, x: 0.7, y: 0.45, w, h });
}

// ===== Helper: footer =====
function addFooter(s, pageNum, totalPages = 10) {
  s.addText('ENS · Escola de Negócios e Seguros', {
    x: 0.7, y: 7.1, w: 6, h: 0.3, fontFace: 'Outfit', fontSize: 10, color: '707070', bold: true
  });
  s.addText(`${String(pageNum).padStart(2, '0')} / ${totalPages}`, {
    x: 11.5, y: 7.1, w: 1.3, h: 0.3, align: 'right', fontFace: 'Outfit', fontSize: 10, color: '707070', bold: true
  });
}

// ===== Helper: eyebrow + accent line + headline (padrão para slides creme) =====
function addEyebrow(s, text, y = 0.95) {
  s.addText(text, {
    x: 0.7, y, w: 12, h: 0.3, fontFace: 'Outfit', fontSize: 11, bold: true, color: ORANGE, charSpacing: 3
  });
  s.addShape('rect', { x: 0.7, y: y + 0.4, w: 1.0, h: 0.04, fill: { color: ORANGE }, line: { type: 'none' } });
}

// =========================================================
// SLIDE 1 — CAPA (overlay LARANJA, não teal)
// =========================================================
{
  const s = pptx.addSlide();
  s.background = { path: CAPA_BG };
  // Overlay LARANJA — cor primária da Graduação
  s.addShape('rect', { x: 0, y: 0, w: 13.333, h: 7.5, fill: { color: ORANGE, transparency: 8 }, line: { type: 'none' } });
  addLogoWhite(s);
  // Eyebrow
  s.addText('GRADUAÇÃO · APRESENTAÇÃO PARA ESCOLAS', {
    x: 0, y: 1.6, w: 13.333, h: 0.3, align: 'center', valign: 'middle',
    fontFace: 'Outfit', fontSize: 14, bold: true, color: WHITE, charSpacing: 4
  });
  s.addShape('rect', { x: 6.4, y: 2.05, w: 0.55, h: 0.04, fill: { color: WHITE }, line: { type: 'none' } });
  // Headline
  s.addText('Sua carreira começa agora.', {
    x: 0.5, y: 2.4, w: 12.333, h: 1.0, align: 'center', valign: 'middle',
    fontFace: 'Outfit', fontSize: 72, bold: true, color: WHITE, charSpacing: -2.5
  });
  s.addText('Gestão de Seguros.', {
    x: 0.5, y: 3.4, w: 12.333, h: 1.0, align: 'center', valign: 'middle',
    fontFace: 'Outfit', fontSize: 72, bold: true, color: WHITE, charSpacing: -2.5
  });
  s.addShape('rect', { x: 6.4, y: 4.55, w: 0.55, h: 0.04, fill: { color: WHITE }, line: { type: 'none' } });
  s.addText('A graduação tecnológica de 2 anos que forma os profissionais que o mercado de seguros mais procura.', {
    x: 1.5, y: 4.75, w: 10.333, h: 0.7, align: 'center', valign: 'middle',
    fontFace: 'Outfit', fontSize: 20, color: WHITE
  });
  // Pills
  const pills = ['ENS · 50 ANOS', '100% ONLINE', '2 ANOS'];
  const pillW = 1.9, pillH = 0.45, pillGap = 0.18;
  const totalW = pills.length * pillW + (pills.length - 1) * pillGap;
  const startX = (13.333 - totalW) / 2;
  pills.forEach((label, i) => {
    s.addShape('roundRect', {
      x: startX + i * (pillW + pillGap), y: 5.95, w: pillW, h: pillH,
      fill: { color: WHITE, transparency: 80 }, line: { color: WHITE, width: 1, transparency: 60 },
      rectRadius: 0.225
    });
    s.addText(label, {
      x: startX + i * (pillW + pillGap), y: 5.95, w: pillW, h: pillH, align: 'center', valign: 'middle',
      fontFace: 'Outfit', fontSize: 13, bold: true, color: WHITE, charSpacing: 2
    });
  });
  s.addText('ENS · Escola de Negócios e Seguros', {
    x: 0.5, y: 7.1, w: 6, h: 0.3, fontFace: 'Outfit', fontSize: 11, color: 'FFEEDD', bold: true
  });
  s.addText('2026', {
    x: 11.5, y: 7.1, w: 1.3, h: 0.3, align: 'right', fontFace: 'Outfit', fontSize: 11, color: 'FFEEDD', bold: true
  });
}

// =========================================================
// SLIDE 2 — QUEM SOMOS (fundo creme)
// =========================================================
{
  const s = pptx.addSlide();
  s.background = { color: CREAM };
  addLogoBlue(s);
  addEyebrow(s, 'QUEM SOMOS');
  // Headline + texto à esquerda
  s.addText('50 anos formando\nos líderes do seguro\nbrasileiro', {
    x: 0.7, y: 1.5, w: 7, h: 2.5, fontFace: 'Outfit', fontSize: 50, bold: true, color: INK, charSpacing: -1.8, valign: 'top'
  });
  s.addText('Fundada em 1971 pelos principais atores do setor de seguros, a ENS é referência no ensino de negócios e securitário no Brasil. Conectamos educação, mercado e desenvolvimento profissional.', {
    x: 0.7, y: 4.3, w: 6.5, h: 1.5, fontFace: 'Outfit', fontSize: 15, color: INK_SOFT, valign: 'top'
  });
  s.addShape('rect', { x: 0.7, y: 6.0, w: 0.8, h: 0.04, fill: { color: ORANGE }, line: { type: 'none' } });
  s.addText('ENS · 1971', {
    x: 1.6, y: 5.88, w: 3, h: 0.3, fontFace: 'Outfit', fontSize: 11, bold: true, color: ORANGE, charSpacing: 2
  });
  // 3 KPIs à direita
  const kpis = [
    { num: '1971', label: 'Ano de fundação' },
    { num: '50+', label: 'Anos de tradição' },
    { num: '1ª', label: 'Referência em seguros' }
  ];
  kpis.forEach((k, i) => {
    const y = 1.5 + i * 1.45;
    s.addShape('roundRect', {
      x: 8.5, y, w: 4.3, h: 1.25, fill: { color: WHITE }, line: { type: 'none' }, rectRadius: 0.12
    });
    s.addShape('rect', { x: 8.5, y, w: 0.08, h: 1.25, fill: { color: ORANGE }, line: { type: 'none' } });
    s.addText(k.num, {
      x: 8.7, y: y + 0.1, w: 4, h: 0.7, fontFace: 'Outfit', fontSize: 44, bold: true, color: ORANGE, charSpacing: -1.5
    });
    s.addText(k.label.toUpperCase(), {
      x: 8.7, y: y + 0.78, w: 4, h: 0.4, fontFace: 'Outfit', fontSize: 11, color: INK_SOFT, charSpacing: 2, bold: true
    });
  });
  // Strip inferior teal
  s.addShape('roundRect', {
    x: 0.7, y: 6.4, w: 12, h: 0.55, fill: { color: TEAL }, line: { type: 'none' }, rectRadius: 0.1
  });
  s.addText([
    { text: 'EDUCAÇÃO TRANSFORMADORA', options: { bold: true, charSpacing: 1.5 } },
    { text: '   ·   ', options: {} },
    { text: 'CULTURA DE SEGUROS', options: { bold: true, charSpacing: 1.5 } },
    { text: '   ·   ', options: {} },
    { text: 'CONEXÃO COM O MERCADO', options: { bold: true, charSpacing: 1.5 } }
  ], {
    x: 0.7, y: 6.4, w: 12, h: 0.55, align: 'center', valign: 'middle',
    fontFace: 'Outfit', fontSize: 13, color: WHITE
  });
  addFooter(s, 2);
}

// =========================================================
// SLIDE 3 — POR QUE GESTÃO DE SEGUROS (fundo creme + SVG icons)
// =========================================================
{
  const s = pptx.addSlide();
  s.background = { color: CREAM };
  addLogoBlue(s);
  addEyebrow(s, 'O MERCADO');
  // Imagem à direita (city_sunrise, 1536x1024 = 1.5 ratio, target 6.5/7.5 = 0.867)
  // Crop horizontal para 0.867 ratio
  // Actually 6.5 wide x 7.5 high = ratio 0.867 — close to 1.5, just slight crop
  s.addImage({ path: CITY, x: 6.83, y: 0, w: 6.5, h: 7.5, sizing: { type: 'cover', w: 6.5, h: 7.5 } });
  // Headline à esquerda
  s.addText('O seguro é uma das áreas que mais cresce — e mais emprega — no Brasil.', {
    x: 0.7, y: 1.5, w: 6, h: 2.6, fontFace: 'Outfit', fontSize: 32, bold: true, color: INK, charSpacing: -1.0, valign: 'top'
  });
  s.addText('De carros a planos de saúde, de empresas a celulares: o seguro está em todo lugar. Uma das áreas mais resilientes da economia.', {
    x: 0.7, y: 4.3, w: 6, h: 1.3, fontFace: 'Outfit', fontSize: 14, color: INK_SOFT, valign: 'top'
  });
  // 3 cards horizontais — SUBIDOS (y=4.95 ao invés de 5.6) + ícones SVG lucide
  const cards = [
    { title: 'Sempre em alta', desc: 'Pessoas, carros, empresas, saúde: o seguro está em todo lugar.', icon: 'chart' },
    { title: 'Emprego garantido', desc: 'Vagas em todo o país. Quem se forma, trabalha.', icon: 'briefcase' },
    { title: 'Boa remuneração', desc: 'Plano de carreira sólido e a chance de empreender.', icon: 'clock' }
  ];
  cards.forEach((c, i) => {
    const x = 0.7 + i * 2.0;
    s.addShape('roundRect', {
      x, y: 4.95, w: 1.85, h: 1.55, fill: { color: WHITE }, line: { color: CREAM_DARK, width: 1 }, rectRadius: 0.1
    });
    // Ícone container laranja claro
    s.addShape('roundRect', {
      x: x + 0.12, y: 5.07, w: 0.42, h: 0.42, fill: { color: PAPER }, line: { type: 'none' }, rectRadius: 0.08
    });
    // Ícone lucide via PNG (não SVG inline, não emoji)
    const iconPath = c.icon === 'chart'
      ? path.join(assetsDir, 'icon_chart.png')
      : c.icon === 'briefcase'
        ? path.join(assetsDir, 'icon_briefcase.png')
        : path.join(assetsDir, 'icon_clock.png');
    s.addImage({ path: iconPath, x: x + 0.16, y: 5.11, w: 0.34, h: 0.34 });
    s.addText(c.title, {
      x: x + 0.08, y: 5.55, w: 1.7, h: 0.32, fontFace: 'Outfit', fontSize: 13, bold: true, color: INK
    });
    s.addText(c.desc, {
      x: x + 0.08, y: 5.88, w: 1.7, h: 0.6, fontFace: 'Outfit', fontSize: 10, color: INK_SOFT, valign: 'top'
    });
  });
  addFooter(s, 3);
}

// =========================================================
// SLIDE 4 — O CURSO EM NÚMEROS (fundo creme)
// =========================================================
{
  const s = pptx.addSlide();
  s.background = { color: CREAM };
  addLogoBlue(s);
  addEyebrow(s, 'O CURSO');
  s.addText('Tecnológico. Em 2 anos.\nCom diploma + 4 certificações.', {
    x: 0.7, y: 1.5, w: 12, h: 1.8, fontFace: 'Outfit', fontSize: 44, bold: true, color: INK, charSpacing: -1.5, valign: 'top'
  });
  // Grid 3x2 de KPIs
  const kpis = [
    { num: '2', label: 'anos de curso' },
    { num: '1.600h', label: 'carga horária' },
    { num: '4', label: 'certificações' },
    { num: '100%', label: 'aulas online' },
    { num: 'R$ 319', label: 'parcela a partir de' },
    { num: '1', label: 'exame de corretor' }
  ];
  kpis.forEach((k, i) => {
    const col = i % 3, row = Math.floor(i / 3);
    const x = 0.7 + col * 2.65;
    const y = 3.7 + row * 1.4;
    s.addShape('roundRect', {
      x, y, w: 2.45, h: 1.2, fill: { color: WHITE }, line: { color: CREAM_DARK, width: 1 }, rectRadius: 0.12
    });
    s.addText(k.num, {
      x: x + 0.1, y: y + 0.1, w: 2.25, h: 0.7, align: 'center', valign: 'middle',
      fontFace: 'Outfit', fontSize: k.num.length > 4 ? 32 : 48, bold: true, color: ORANGE, charSpacing: -1.5
    });
    s.addText(k.label.toUpperCase(), {
      x: x + 0.1, y: y + 0.78, w: 2.25, h: 0.32, align: 'center',
      fontFace: 'Outfit', fontSize: 10, color: INK_SOFT, charSpacing: 1.5, bold: true
    });
  });
  // Nota lateral teal
  s.addShape('roundRect', {
    x: 9.1, y: 3.7, w: 3.55, h: 2.6, fill: { color: TEAL }, line: { type: 'none' }, rectRadius: 0.12
  });
  s.addShape('rect', { x: 9.3, y: 3.9, w: 0.6, h: 0.04, fill: { color: ORANGE }, line: { type: 'none' } });
  s.addText('DIFERENCIAL ENS', {
    x: 9.3, y: 4.0, w: 3.3, h: 0.3, fontFace: 'Outfit', fontSize: 10, bold: true, color: ORANGE, charSpacing: 2
  });
  s.addText('4 certificações parciais a cada semestre', {
    x: 9.3, y: 4.3, w: 3.3, h: 0.9, fontFace: 'Outfit', fontSize: 19, bold: true, color: WHITE, valign: 'top'
  });
  s.addText('Você sai com diploma de nível superior E com 4 certificações que te colocam dentro do mercado antes mesmo de se formar.', {
    x: 9.3, y: 5.2, w: 3.3, h: 1.0, fontFace: 'Outfit', fontSize: 11, color: 'DDEEEE', valign: 'top'
  });
  addFooter(s, 4);
}

// =========================================================
// SLIDE 5 — GRADE CURRICULAR (fundo creme)
// =========================================================
{
  const s = pptx.addSlide();
  s.background = { color: CREAM };
  addLogoBlue(s);
  addEyebrow(s, 'GRADE CURRICULAR');
  s.addText('O que você aprende em cada semestre', {
    x: 0.7, y: 1.5, w: 12, h: 0.9, fontFace: 'Outfit', fontSize: 40, bold: true, color: INK, charSpacing: -1.5, valign: 'top'
  });
  const periods = [
    { p: '1º período', h: '440h', cert: 'Auxiliar Técnico de Seguros', topics: ['Teoria Geral de Seguros', 'Comunicação Empresarial', 'Filosofia, Ética e Responsabilidade', 'Modelos de Gestão'] },
    { p: '2º período', h: '400h', cert: 'Assistente Técnico — Pessoas', topics: ['Direito Aplicado ao Seguro', 'Seguros de Pessoas e Saúde', 'Previdência Complementar', 'Contabilidade Básica'] },
    { p: '3º período', h: '400h', cert: 'Assistente Técnico — Riscos', topics: ['Matemática Atuarial', 'Automóveis, Transportes, Cascos', 'Riscos Patrimoniais', 'Responsabilidade Civil'] },
    { p: '4º período', h: '360h', cert: 'Analista Técnico de Seguros', topics: ['Gestão de Riscos', 'Gestão Comercial de Seguros', 'Gestão de Projetos', 'Matemática Financeira'] }
  ];
  periods.forEach((p, i) => {
    const x = 0.7 + i * 3.05;
    s.addShape('roundRect', {
      x, y: 2.6, w: 2.85, h: 3.5, fill: { color: WHITE }, line: { color: CREAM_DARK, width: 1 }, rectRadius: 0.12
    });
    s.addText(p.p.toUpperCase(), {
      x: x + 0.18, y: 2.75, w: 2.5, h: 0.3, fontFace: 'Outfit', fontSize: 11, bold: true, color: ORANGE, charSpacing: 2
    });
    s.addText(p.h, {
      x: x + 0.18, y: 3.05, w: 2.5, h: 0.6, fontFace: 'Outfit', fontSize: 32, bold: true, color: INK, charSpacing: -1
    });
    s.addShape('rect', { x: x + 0.18, y: 3.7, w: 1.5, h: 0.02, fill: { color: PAPER }, line: { type: 'none' } });
    s.addText(p.cert, {
      x: x + 0.18, y: 3.78, w: 2.5, h: 0.55, fontFace: 'Outfit', fontSize: 12, bold: true, color: TEAL, valign: 'top'
    });
    const items = p.topics.map(t => ({ text: t, options: { breakLine: true } }));
    s.addText(items, {
      x: x + 0.18, y: 4.4, w: 2.5, h: 1.6, fontFace: 'Outfit', fontSize: 11, color: INK_SOFT, valign: 'top',
      paraSpaceAfter: 4
    });
  });
  // Strip laranja inferior
  s.addShape('roundRect', {
    x: 0.7, y: 6.3, w: 12, h: 0.65, fill: { color: ORANGE }, line: { type: 'none' }, rectRadius: 0.12
  });
  s.addText('A cada semestre, você sai com uma certificação profissional parcial — antes mesmo do diploma.', {
    x: 0.7, y: 6.3, w: 12, h: 0.65, align: 'center', valign: 'middle',
    fontFace: 'Outfit', fontSize: 16, bold: true, color: WHITE
  });
  addFooter(s, 5);
}

// =========================================================
// SLIDE 6 — DUAS FORMAÇÕES (fundo creme + foto croppada)
// =========================================================
{
  const s = pptx.addSlide();
  s.background = { color: CREAM };
  addLogoBlue(s);
  // Imagem croppada à direita (523x1024 = ratio 0.511, target slot 3.833x7.5 = 0.511 — match perfeito)
  s.addImage({ path: PORTRAIT_CROP, x: 9.5, y: 0, w: 3.833, h: 7.5, sizing: { type: 'cover', w: 3.833, h: 7.5 } });
  addEyebrow(s, 'DIFERENCIAL');
  s.addText('Um curso.\nDuas profissões.', {
    x: 0.7, y: 1.5, w: 8, h: 1.8, fontFace: 'Outfit', fontSize: 56, bold: true, color: INK, charSpacing: -2, valign: 'top'
  });
  // 2 cards
  const cards = [
    { label: 'PROFISSÃO 01', title: 'Gestor de Seguros', desc: 'Analisa riscos, estrutura produtos e gerencia carteiras em seguradoras e resseguradoras.', color: ORANGE },
    { label: 'PROFISSÃO 02', title: 'Corretor de Seguros', desc: 'Habilitado pela SUSEP para vender e assessorar. Pode empreender desde o início.', color: TEAL }
  ];
  cards.forEach((c, i) => {
    const x = 0.7 + i * 4.3;
    s.addShape('roundRect', {
      x, y: 3.6, w: 4.1, h: 2.6, fill: { color: WHITE }, line: { color: c.color, width: 2 }, rectRadius: 0.12
    });
    s.addShape('roundRect', {
      x: x + 0.2, y: 3.75, w: 0.65, h: 0.65, fill: { color: c.color }, line: { type: 'none' }, rectRadius: 0.12
    });
    s.addText(c.label, {
      x: x + 0.95, y: 3.85, w: 3, h: 0.3, fontFace: 'Outfit', fontSize: 10, bold: true, color: c.color, charSpacing: 2
    });
    s.addText(c.title, {
      x: x + 0.2, y: 4.55, w: 3.8, h: 0.55, fontFace: 'Outfit', fontSize: 24, bold: true, color: INK, charSpacing: -0.5
    });
    s.addText(c.desc, {
      x: x + 0.2, y: 5.15, w: 3.8, h: 0.95, fontFace: 'Outfit', fontSize: 12, color: INK_SOFT, valign: 'top'
    });
  });
  // Strip bônus
  s.addShape('roundRect', {
    x: 0.7, y: 6.4, w: 8.5, h: 0.6, fill: { color: ORANGE }, line: { type: 'none' }, rectRadius: 0.1
  });
  s.addText([
    { text: 'BÔNUS INCLUSO   ', options: { bold: true, fontSize: 11, charSpacing: 2 } },
    { text: 'O Exame para Habilitação de Corretor está incluso — sem custo adicional.', options: { bold: true, fontSize: 15 } }
  ], {
    x: 0.9, y: 6.4, w: 8.1, h: 0.6, valign: 'middle', fontFace: 'Outfit', color: WHITE
  });
  addFooter(s, 6);
}

// =========================================================
// SLIDE 7 — PARA QUEM É (fundo creme + foto croppada)
// =========================================================
{
  const s = pptx.addSlide();
  s.background = { color: CREAM };
  addLogoBlue(s);
  // Imagem croppada à esquerda (682x1024 = ratio 0.667, slot 5.0x7.5 = 0.667 — match)
  s.addImage({ path: YOUNG_CROP, x: 0, y: 0, w: 5.0, h: 7.5, sizing: { type: 'cover', w: 5.0, h: 7.5 } });
  addEyebrow(s, 'PARA QUEM É', 0.85);
  s.addText('Se você terminou\n(ou está terminando)\no ensino médio —\né pra você.', {
    x: 5.3, y: 1.3, w: 7.5, h: 2.7, fontFace: 'Outfit', fontSize: 38, bold: true, color: INK, charSpacing: -1.3, valign: 'top'
  });
  s.addText('Quer entrar rápido no mercado com diploma, gestão e boa renda? Essa graduação foi feita pra você.', {
    x: 5.3, y: 4.1, w: 7.5, h: 0.9, fontFace: 'Outfit', fontSize: 14, color: INK_SOFT, valign: 'top'
  });
  // 4 cards 2x2
  const exits = [
    { code: '01', title: 'Analista de Seguros', desc: 'Seguradoras e resseguradoras' },
    { code: '02', title: 'Corretor de Seguros', desc: 'SUSEP · autônomo ou corretora' },
    { code: '03', title: 'Gestor de Riscos', desc: 'Empresas, bancos, consultorias' },
    { code: '04', title: 'Gestor Comercial', desc: 'Corretoras, bancos, fintechs' }
  ];
  exits.forEach((e, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = 5.3 + col * 3.85;
    const y = 5.2 + row * 0.85;
    s.addShape('roundRect', {
      x, y, w: 3.7, h: 0.78, fill: { color: WHITE }, line: { type: 'none' }, rectRadius: 0.1
    });
    s.addShape('rect', { x, y, w: 0.06, h: 0.78, fill: { color: ORANGE }, line: { type: 'none' } });
    s.addText(`SAÍDA ${e.code}`, {
      x: x + 0.18, y: y + 0.05, w: 3.5, h: 0.22, fontFace: 'Outfit', fontSize: 9, bold: true, color: ORANGE, charSpacing: 1.5
    });
    s.addText(e.title, {
      x: x + 0.18, y: y + 0.26, w: 3.5, h: 0.3, fontFace: 'Outfit', fontSize: 14, bold: true, color: INK
    });
    s.addText(e.desc, {
      x: x + 0.18, y: y + 0.52, w: 3.5, h: 0.24, fontFace: 'Outfit', fontSize: 10, color: INK_SOFT
    });
  });
  addFooter(s, 7);
}

// =========================================================
// SLIDE 8 — INVESTIMENTO (fundo creme)
// =========================================================
{
  const s = pptx.addSlide();
  s.background = { color: CREAM };
  addLogoBlue(s);
  addEyebrow(s, 'INVESTIMENTO');
  s.addText('Cabe no bolso.\nCom bolsas e ENEM.', {
    x: 0.7, y: 1.5, w: 12, h: 1.6, fontFace: 'Outfit', fontSize: 44, bold: true, color: INK, charSpacing: -1.5, valign: 'top'
  });
  // 2 cards de preço
  s.addShape('roundRect', {
    x: 0.7, y: 3.4, w: 4.5, h: 1.8, fill: { color: WHITE }, line: { type: 'none' }, rectRadius: 0.12
  });
  s.addText('PARCELAMENTO PADRÃO', {
    x: 0.9, y: 3.55, w: 4.1, h: 0.3, fontFace: 'Outfit', fontSize: 10, bold: true, color: INK_SOFT, charSpacing: 2
  });
  s.addText('R$ 704,17', {
    x: 0.9, y: 3.85, w: 4.1, h: 0.7, fontFace: 'Outfit', fontSize: 42, bold: true, color: INK, charSpacing: -2
  });
  s.addText('por mês · reajuste anual IPCA', {
    x: 0.9, y: 4.7, w: 4.1, h: 0.3, fontFace: 'Outfit', fontSize: 11, color: INK_SOFT
  });
  s.addShape('roundRect', {
    x: 5.4, y: 3.4, w: 4.5, h: 1.8, fill: { color: ORANGE }, line: { type: 'none' }, rectRadius: 0.12
  });
  s.addShape('roundRect', {
    x: 7.5, y: 3.2, w: 2.2, h: 0.32, fill: { color: TEAL }, line: { type: 'none' }, rectRadius: 0.16
  });
  s.addText('PROMO ATÉ 31/07', {
    x: 7.5, y: 3.2, w: 2.2, h: 0.32, align: 'center', valign: 'middle', fontFace: 'Outfit', fontSize: 10, bold: true, color: WHITE, charSpacing: 1.5
  });
  s.addText('LINEAR ESPECIAL', {
    x: 5.6, y: 3.55, w: 4.1, h: 0.3, fontFace: 'Outfit', fontSize: 10, bold: true, color: 'FFEEDD', charSpacing: 2
  });
  s.addText('R$ 319,47', {
    x: 5.6, y: 3.85, w: 4.1, h: 0.7, fontFace: 'Outfit', fontSize: 42, bold: true, color: WHITE, charSpacing: -2
  });
  s.addText('em até 48x · pague em 4 anos', {
    x: 5.6, y: 4.7, w: 4.1, h: 0.3, fontFace: 'Outfit', fontSize: 11, color: 'FFEEDD'
  });
  // Bloco ENEM teal
  s.addShape('roundRect', {
    x: 10.1, y: 3.4, w: 2.55, h: 2.95, fill: { color: TEAL }, line: { type: 'none' }, rectRadius: 0.12
  });
  s.addShape('rect', { x: 10.3, y: 3.55, w: 0.5, h: 0.04, fill: { color: ORANGE }, line: { type: 'none' } });
  s.addText('BOLSAS ENEM', {
    x: 10.3, y: 3.65, w: 2.3, h: 0.25, fontFace: 'Outfit', fontSize: 10, bold: true, color: ORANGE, charSpacing: 2
  });
  s.addText('Até 80% de bolsa', {
    x: 10.3, y: 3.9, w: 2.3, h: 0.4, fontFace: 'Outfit', fontSize: 16, bold: true, color: WHITE
  });
  const enem = [
    { range: '200-651 pts', pct: '40%' },
    { range: '652-750 pts', pct: '60%' },
    { range: '751-999 pts', pct: '80%' }
  ];
  enem.forEach((e, i) => {
    const y = 4.45 + i * 0.55;
    s.addText(e.range, {
      x: 10.3, y, w: 1.5, h: 0.4, fontFace: 'Outfit', fontSize: 10, color: 'DDEEEE', valign: 'middle'
    });
    s.addText(e.pct, {
      x: 11.7, y, w: 0.85, h: 0.4, align: 'right', fontFace: 'Outfit', fontSize: 16, bold: true, color: ORANGE, valign: 'middle'
    });
  });
  // Strip de descontos
  s.addShape('roundRect', {
    x: 0.7, y: 5.55, w: 9.2, h: 0.55, fill: { color: WHITE }, line: { type: 'none' }, rectRadius: 0.1
  });
  s.addText([
    { text: '✓ 30% transferidos   ', options: { color: ORANGE, bold: true } },
    { text: '✓ 20% empresas conveniadas   ', options: { color: ORANGE, bold: true } },
    { text: '✓ 5% pontualidade', options: { color: ORANGE, bold: true } }
  ], {
    x: 0.7, y: 5.55, w: 9.2, h: 0.55, align: 'center', valign: 'middle', fontFace: 'Outfit', fontSize: 13
  });
  // CTA mini
  s.addShape('roundRect', {
    x: 0.7, y: 6.3, w: 9.2, h: 0.55, fill: { color: CREAM_DARK }, line: { type: 'none' }, rectRadius: 0.1
  });
  s.addText([
    { text: 'Matrículas até ', options: { color: INK, bold: true } },
    { text: '06/07', options: { color: ORANGE, bold: true } },
    { text: ': 1ª mensalidade por ', options: { color: INK, bold: true } },
    { text: 'R$ 149', options: { color: ORANGE, bold: true } }
  ], {
    x: 0.7, y: 6.3, w: 9.2, h: 0.55, align: 'center', valign: 'middle', fontFace: 'Outfit', fontSize: 14
  });
  addFooter(s, 8);
}

// =========================================================
// SLIDE 9 — COMO ENTRAR (fundo creme)
// =========================================================
{
  const s = pptx.addSlide();
  s.background = { color: CREAM };
  addLogoBlue(s);
  s.addImage({ path: DESK, x: 9.5, y: 0, w: 3.833, h: 7.5, sizing: { type: 'cover', w: 3.833, h: 7.5 } });
  addEyebrow(s, 'PROCESSO SELETIVO', 0.85);
  s.addText('4 caminhos para\ngarantir sua vaga', {
    x: 0.7, y: 1.3, w: 8.5, h: 1.6, fontFace: 'Outfit', fontSize: 44, bold: true, color: INK, charSpacing: -1.5, valign: 'top'
  });
  const paths = [
    { code: '01', title: 'Vestibular', desc: 'Redação online, gratuita, sem taxa.' },
    { code: '02', title: 'ENEM', desc: 'A partir de 350 pontos (2021-2025).' },
    { code: '03', title: '2ª Graduação', desc: 'Já tem diploma superior? Matrícula direta.' },
    { code: '04', title: 'Transferência', desc: 'Traga seu histórico de outra faculdade.' }
  ];
  paths.forEach((p, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = 0.7 + col * 4.3;
    const y = 3.1 + row * 1.6;
    s.addShape('roundRect', {
      x, y, w: 4.1, h: 1.4, fill: { color: WHITE }, line: { color: CREAM_DARK, width: 1 }, rectRadius: 0.12
    });
    s.addShape('roundRect', {
      x: x + 0.18, y: y + 0.18, w: 0.4, h: 0.4, fill: { color: PAPER }, line: { type: 'none' }, rectRadius: 0.08
    });
    s.addText(p.code, {
      x: x + 0.18, y: y + 0.18, w: 0.4, h: 0.4, align: 'center', valign: 'middle', fontFace: 'Outfit', fontSize: 14, bold: true, color: ORANGE
    });
    s.addText(`CAMINHO ${p.code}`, {
      x: x + 0.7, y: y + 0.2, w: 3.2, h: 0.25, fontFace: 'Outfit', fontSize: 10, bold: true, color: ORANGE, charSpacing: 1.5
    });
    s.addText(p.title, {
      x: x + 0.7, y: y + 0.42, w: 3.2, h: 0.4, fontFace: 'Outfit', fontSize: 18, bold: true, color: INK
    });
    s.addText(p.desc, {
      x: x + 0.18, y: y + 0.85, w: 3.7, h: 0.45, fontFace: 'Outfit', fontSize: 11, color: INK_SOFT, valign: 'top'
    });
  });
  // Mini FAQ strip
  s.addShape('roundRect', {
    x: 0.7, y: 6.4, w: 8.5, h: 0.55, fill: { color: WHITE }, line: { type: 'none' }, rectRadius: 0.1
  });
  s.addText([
    { text: 'TAXA?  ', options: { bold: true, color: ORANGE, charSpacing: 1 } },
    { text: 'Não · gratuita   |   ', options: { color: INK } },
    { text: 'INÍCIO?  ', options: { bold: true, color: ORANGE, charSpacing: 1 } },
    { text: '03/08/2026   |   ', options: { color: INK } },
    { text: 'MODALIDADE?  ', options: { bold: true, color: ORANGE, charSpacing: 1 } },
    { text: '100% online', options: { color: INK } }
  ], {
    x: 0.7, y: 6.4, w: 8.5, h: 0.55, align: 'center', valign: 'middle', fontFace: 'Outfit', fontSize: 12
  });
  addFooter(s, 9);
}

// =========================================================
// SLIDE 10 — ENCERRAMENTO (overlay laranja + logo PNG)
// =========================================================
{
  const s = pptx.addSlide();
  s.background = { path: CAPA_BG };
  s.addShape('rect', { x: 0, y: 0, w: 13.333, h: 7.5, fill: { color: ORANGE, transparency: 8 }, line: { type: 'none' } });
  addLogoWhite(s);
  s.addText('PRÓXIMO PASSO', {
    x: 0, y: 1.5, w: 13.333, h: 0.3, align: 'center', valign: 'middle',
    fontFace: 'Outfit', fontSize: 14, bold: true, color: WHITE, charSpacing: 4
  });
  s.addShape('rect', { x: 6.4, y: 1.95, w: 0.55, h: 0.04, fill: { color: WHITE }, line: { type: 'none' } });
  s.addText('Tá esperando o quê?', {
    x: 0.5, y: 2.3, w: 12.333, h: 1.6, align: 'center', valign: 'middle',
    fontFace: 'Outfit', fontSize: 92, bold: true, color: WHITE, charSpacing: -3
  });
  s.addText('Garanta sua vaga na Graduação em Gestão de Seguros da ENS.', {
    x: 1.5, y: 4.0, w: 10.333, h: 0.6, align: 'center', valign: 'middle',
    fontFace: 'Outfit', fontSize: 24, bold: true, color: WHITE
  });
  const contacts = [
    { label: 'e-mail', value: 'vestibular@ens.edu.br' },
    { label: 'site', value: 'ens.edu.br/graduacao' },
    { label: 'início das aulas', value: '03 de agosto' }
  ];
  const cardW = 4.0, cardH = 1.3, cardGap = 0.25;
  const cardStartX = (13.333 - (contacts.length * cardW + (contacts.length - 1) * cardGap)) / 2;
  contacts.forEach((c, i) => {
    const x = cardStartX + i * (cardW + cardGap);
    s.addShape('roundRect', {
      x, y: 5.0, w: cardW, h: cardH, fill: { color: WHITE, transparency: 85 }, line: { color: WHITE, width: 1, transparency: 60 }, rectRadius: 0.12
    });
    s.addText(c.label.toUpperCase(), {
      x: x + 0.25, y: 5.15, w: cardW - 0.5, h: 0.3, fontFace: 'Outfit', fontSize: 11, bold: true, color: 'FFEEDD', charSpacing: 2
    });
    s.addText(c.value, {
      x: x + 0.25, y: 5.5, w: cardW - 0.5, h: 0.6, fontFace: 'Outfit', fontSize: 22, bold: true, color: WHITE
    });
  });
  s.addText('ENS · 50 ANOS FORMANDO OS LÍDERES DO SEGURO', {
    x: 0.5, y: 7.1, w: 8, h: 0.3, fontFace: 'Outfit', fontSize: 12, color: WHITE, bold: true, charSpacing: 1.5
  });
  s.addText('10 / 10', {
    x: 11.5, y: 7.1, w: 1.3, h: 0.3, align: 'right', fontFace: 'Outfit', fontSize: 11, color: 'FFEEDD', bold: true
  });
}

// ===== SAVE =====
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, outName + '.pptx');
pptx.writeFile({ fileName: outPath }).then(p => {
  console.log('OK:', p);
  console.log('  size:', fs.statSync(outPath).size, 'bytes');
}).catch(e => {
  console.error('Erro:', e.message);
  process.exit(1);
});