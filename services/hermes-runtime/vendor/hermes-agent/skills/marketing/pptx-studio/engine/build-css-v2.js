/* engine/build-css-v2.js — Compila primitives modulares.
 *
 * Diferenca do build-css.js original:
 * - Concatena arquivos .css (sem minificar, preserva formatacao)
 * - Resolve @import "./arquivo.css" recursivamente
 * - Mantem compat com dom-to-pptx (CSS injetado inline no HTML)
 *
 * v3.5+ change: suporta estrutura modular de primitives/.
 * Antes (v1.0): 1 unico styles.css.
 * Agora: input.css que importa styles.css + timeline.css + comparison.css + quote.css + stats.css
 */

const fs = require("fs");
const path = require("path");

const PRIMITIVES_DIR = path.join(__dirname, "..", "primitives");
const OUTPUT = path.join(PRIMITIVES_DIR, "dist", "styles.css");

function readCssFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error("WARN: arquivo nao existe: " + filePath);
    return "";
  }
  return fs.readFileSync(filePath, "utf8");
}

function resolveImports(css, baseDir, depth = 0) {
  if (depth > 5) {
    console.error("WARN: profundidade de @import > 5, parando");
    return css;
  }
  // Encontrar @import "./arquivo.css" ou @import url('./arquivo.css')
  const importRe = /@import\s+(?:url\()?['"]\.\/([^'"]+)['"]\)?[^;]*;/g;
  return css.replace(importRe, (match, filename) => {
    const subPath = path.join(baseDir, filename);
    const subContent = readCssFile(subPath);
    if (!subContent) return "";
    // Resolver imports recursivamente
    return resolveImports(subContent, path.dirname(subPath), depth + 1);
  });
}

function build() {
  const inputPath = path.join(PRIMITIVES_DIR, "input.css");
  if (!fs.existsSync(inputPath)) {
    console.error("Input nao encontrado: " + inputPath);
    process.exit(1);
  }

  let css = readCssFile(inputPath);
  if (!css) {
    console.error("input.css vazio");
    process.exit(1);
  }

  // Resolver @import recursivamente
  css = resolveImports(css, PRIMITIVES_DIR);

  // Preservar @import url() externo (Google Fonts etc) - NAO remover
  // Apenas resolver @import "./local.css" (feito acima)

  // Garantir separacao limpa entre modulos
  css = css.replace(/}\s*(@import|\/\*)/g, "}\n\n$1");

  // Header com metadata
  const header = `/* pptx-studio v3.5+ — COMPILED primitives
 *
 * GERADO POR: engine/build-css-v2.js
 * NAO EDITAR DIRETAMENTE — editar primitives/input.css e os modulos.
 *
 * Modulos incluidos:
 * - styles.css      (base, original desde v1.0)
 * - timeline.css    (v3.5+)
 * - comparison.css  (v3.5+)
 * - quote.css       (v3.5+)
 * - stats.css       (v3.5+)
 */
`;

  css = header + "\n" + css;

  // Escrever
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, css);
  const size = fs.statSync(OUTPUT).size;
  console.log(`CSS compiled: ${(size/1024).toFixed(1)}KB (${OUTPUT})`);
  console.log(`Modulos encontrados:`);
  ["styles", "timeline", "comparison", "quote", "stats"].forEach((m) => {
    if (css.includes(m + ".css") || css.includes("." + m)) {
      console.log(`  - ${m}.css: OK`);
    } else {
      console.log(`  - ${m}.css: NOT FOUND (checar input.css)`);
    }
  });
}

if (require.main === module) {
  build();
}

module.exports = { build, resolveImports };
