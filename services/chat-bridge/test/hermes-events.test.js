import assert from "node:assert/strict";
import test from "node:test";

import {
  buildHermesRunSessionId,
  parseHermesEventBlock,
  parseHermesStatusPayload,
} from "../src/hermes-events.js";

const context = {
  requestId: "req_123",
  runId: "run_123",
  sessionId: "nexus:session-1",
  streamedText: "",
};

test("buildHermesRunSessionId creates stable short ids", () => {
  const raw = "a4447dba-b3be-4123-9e27-48d21384b3e9";
  const first = buildHermesRunSessionId(raw);
  const second = buildHermesRunSessionId(raw);

  assert.equal(first, second);
  assert.equal(first.startsWith("nexus:"), true);
  assert.equal(first.length <= 64, true);
});

test("parseHermesEventBlock emits delta for assistant delta events", () => {
  const parsed = parseHermesEventBlock(
    'data: {"event":"assistant.delta","run_id":"run_123","delta":"Oi"}',
    context,
  );

  assert.deepEqual(parsed.events, [{ event: "delta", data: { delta: "Oi" } }]);
  assert.equal(parsed.streamedText, "Oi");
  assert.equal(parsed.completed, false);
});

test("parseHermesEventBlock emits delta for Responses API text delta events", () => {
  const parsed = parseHermesEventBlock(
    'event: response.output_text.delta\ndata: {"delta":"Oi pelo responses"}',
    context,
  );

  assert.deepEqual(parsed.events, [{ event: "delta", data: { delta: "Oi pelo responses" } }]);
  assert.equal(parsed.streamedText, "Oi pelo responses");
  assert.equal(parsed.completed, false);
});

test("parseHermesEventBlock completes Responses API events and exposes response id", () => {
  const parsed = parseHermesEventBlock(
    'event: response.completed\ndata: {"id":"resp_123","output":[{"type":"message","role":"assistant","content":[{"type":"output_text","text":"Pronto"}]}]}',
    context,
  );

  assert.equal(parsed.responseId, "resp_123");
  assert.equal(parsed.completed, true);
  assert.equal(parsed.events.at(-1).event, "done");
  assert.equal(parsed.events[0].data.delta, "Pronto");
});

test("parseHermesEventBlock emits missing final text, files and done on run.completed", () => {
  const parsed = parseHermesEventBlock(
    'data: {"event":"run.completed","run_id":"run_123","session_id":"session-1","output":"Imagem pronta.","files":[{"url":"https://cdn.example/image.png","name":"image.png","mimeType":"image/png"}]}',
    context,
  );

  assert.deepEqual(parsed.events, [
    { event: "delta", data: { delta: "Imagem pronta." } },
    {
      event: "files",
      data: {
        files: [{
          name: "image.png",
          url: "https://cdn.example/image.png",
          kind: "image",
          mimeType: "image/png",
        }],
      },
    },
    {
      event: "meta",
      data: {
        provider: "hermes",
        event: "run.completed",
        run_id: "run_123",
        session_id: "session-1",
      },
    },
    { event: "done", data: { request_id: "req_123" } },
  ]);
  assert.equal(parsed.completed, true);
});

test("parseHermesEventBlock exposes Supabase-generated image metadata", () => {
  const parsed = parseHermesEventBlock(
    'data: {"event":"run.completed","run_id":"run_123","session_id":"session-1","output":"Imagem pronta.","result":{"type":"image","image_url":"https://project.supabase.co/storage/v1/object/sign/image-gen-outputs/hermes-chat-images/nexus-chat-1/openai.png?token=abc","name":"openai.png","mime_type":"image/png","storage_path":"hermes-chat-images/nexus-chat-1/openai.png","storage_bucket":"image-gen-outputs","signed_url_expires_at":"2026-06-18T12:00:00Z"}}',
    context,
  );

  const filesEvent = parsed.events.find((event) => event.event === "files");
  assert.deepEqual(filesEvent?.data.files, [{
    name: "openai.png",
    url: "https://project.supabase.co/storage/v1/object/sign/image-gen-outputs/hermes-chat-images/nexus-chat-1/openai.png?token=abc",
    kind: "image",
    mimeType: "image/png",
    storage_path: "hermes-chat-images/nexus-chat-1/openai.png",
    storage_bucket: "image-gen-outputs",
    signed_url_expires_at: "2026-06-18T12:00:00Z",
  }]);
  assert.equal(parsed.completed, true);
});

test("parseHermesStatusPayload keeps running runs open and completes terminal runs", () => {
  assert.deepEqual(parseHermesStatusPayload({ status: "running" }, context), {
    terminal: false,
    parsed: null,
  });

  const completed = parseHermesStatusPayload({
    status: "completed",
    output: "Terminei pelo status.",
  }, context);

  assert.equal(completed.terminal, true);
  assert.equal(completed.parsed.completed, true);
  assert.equal(completed.parsed.events[0].data.delta, "Terminei pelo status.");
});
