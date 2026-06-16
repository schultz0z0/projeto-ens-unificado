import assert from "node:assert/strict";
import test from "node:test";

import { extractAttachmentText } from "../src/attachment-text.js";

const textEncoder = new TextEncoder();

test("extractAttachmentText strips HTML into readable text", () => {
  const text = extractAttachmentText(
    { name: "pagina.html", mime_type: "text/html" },
    textEncoder.encode("<html><body><h1>Titulo</h1><p>Conteudo &amp; CTA</p><script>alert(1)</script></body></html>"),
  );

  assert.match(text, /Titulo/);
  assert.match(text, /Conteudo & CTA/);
  assert.doesNotMatch(text, /alert/);
});

test("extractAttachmentText treats JSON as plain readable text", () => {
  const text = extractAttachmentText(
    { name: "dados.json", mime_type: "application/json" },
    textEncoder.encode(JSON.stringify({ curso: "China Immersion" })),
  );

  assert.match(text, /China Immersion/);
});
