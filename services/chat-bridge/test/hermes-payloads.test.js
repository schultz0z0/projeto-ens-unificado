import assert from "node:assert/strict";
import test from "node:test";

import {
  buildHermesRunInput,
  buildHermesResponsesInput,
  shouldUseResponsesApi,
} from "../src/hermes-payloads.js";

test("buildHermesResponsesInput sends image attachments as multimodal image parts", () => {
  const input = buildHermesResponsesInput({
    messageText: "analise esta imagem",
    attachments: [{
      kind: "image",
      name: "layout.png",
      mime_type: "image/png",
      storage_path: "user-1/session-1/layout.png",
      signed_url: "https://project.supabase.co/storage/v1/object/sign/chat-attachments/user-1/session-1/layout.png?token=abc",
      inline_data_url: "data:image/png;base64,AAAA",
    }],
    imageTransport: "inline",
  });

  assert.deepEqual(input, [{
    role: "user",
    content: [
      { type: "input_text", text: "analise esta imagem" },
      { type: "input_image", image_url: "data:image/png;base64,AAAA", detail: "auto" },
    ],
  }]);
});

test("buildHermesRunInput includes extracted file text for long running text runs", () => {
  const input = buildHermesRunInput({
    messageText: "resuma",
    attachments: [{
      kind: "file",
      name: "brief.txt",
      mime_type: "text/plain",
      storage_path: "user-1/session-1/brief.txt",
      signed_url: "https://project.supabase.co/storage/v1/object/sign/chat-attachments/user-1/session-1/brief.txt?token=abc",
      extracted_text: "conteudo do brief",
    }],
  });

  assert.match(input, /resuma/);
  assert.match(input, /\[Arquivo: brief\.txt\]/);
  assert.match(input, /conteudo do brief/);
});

test("shouldUseResponsesApi routes images and non-extracted files to multimodal responses", () => {
  assert.equal(shouldUseResponsesApi([]), false);
  assert.equal(shouldUseResponsesApi([{ kind: "image", mime_type: "image/png" }]), true);
  assert.equal(shouldUseResponsesApi([{ kind: "file", mime_type: "application/pdf", extracted_text: "" }]), true);
  assert.equal(shouldUseResponsesApi([{ kind: "file", mime_type: "text/plain", extracted_text: "ok" }]), false);
});
