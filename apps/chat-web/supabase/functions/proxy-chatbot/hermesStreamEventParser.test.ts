import { describe, expect, it } from "vitest";

import { parseHermesEventBlock } from "./hermesStreamEventParser";

describe("parseHermesEventBlock", () => {
  it("emite delta a partir do response.completed quando o provider nao enviou output_text.delta", () => {
    const result = parseHermesEventBlock(
      [
        "event: response.completed",
        'data: {"id":"resp_123","output":[{"type":"message","role":"assistant","content":[{"type":"output_text","text":"Oi, renderiza isso."}]}]}',
        "",
      ].join("\n"),
      {
        conversation: "nexus:user:session",
        requestId: "req_123",
        streamedText: "",
      },
    );

    expect(result.events).toEqual([
      { event: "delta", data: { delta: "Oi, renderiza isso." } },
      {
        event: "meta",
        data: {
          provider: "hermes",
          response_id: "resp_123",
          conversation: "nexus:user:session",
        },
      },
      { event: "done", data: { request_id: "req_123" } },
    ]);
  });

  it("nao duplica texto final quando o response.completed repete o conteudo ja transmitido", () => {
    const result = parseHermesEventBlock(
      [
        "event: response.completed",
        'data: {"id":"resp_456","output":[{"type":"message","role":"assistant","content":[{"type":"output_text","text":"Texto ja transmitido"}]}]}',
        "",
      ].join("\n"),
      {
        conversation: "nexus:user:session",
        requestId: "req_456",
        streamedText: "Texto ja transmitido",
      },
    );

    expect(result.events).toEqual([
      {
        event: "meta",
        data: {
          provider: "hermes",
          response_id: "resp_456",
          conversation: "nexus:user:session",
        },
      },
      { event: "done", data: { request_id: "req_456" } },
    ]);
  });

  it("nao trata como erro fatal quando o Hermes falha depois de ja entregar texto completo", () => {
    const result = parseHermesEventBlock(
      [
        "event: response.failed",
        'data: {"type":"response.failed","response":{"id":"resp_789","status":"failed","output":[{"type":"message","role":"assistant","content":[{"type":"output_text","text":"Resposta util ja entregue."}]}],"error":{"message":"\'NoneType\' object is not iterable","type":"server_error"}}}',
        "",
      ].join("\n"),
      {
        conversation: "nexus:user:session",
        requestId: "req_789",
        streamedText: "Resposta util ja entregue.",
      },
    );

    expect(result.events).toEqual([
      {
        event: "meta",
        data: {
          provider: "hermes",
          event: "response.failed",
          response_id: "resp_789",
          conversation: "nexus:user:session",
          error_code: "NoneType",
          has_assistant_text: true,
          upstream_error_excerpt: "'NoneType' object is not iterable",
        },
      },
      {
        event: "meta",
        data: {
          provider: "hermes",
          response_id: "resp_789",
          conversation: "nexus:user:session",
          recovered_from_failure: true,
        },
      },
      { event: "done", data: { request_id: "req_789" } },
    ]);
  });

  it("nao expõe payload bruto em eventos meta intermediarios", () => {
    const result = parseHermesEventBlock(
      [
        "event: response.output_item.added",
        'data: {"item":{"type":"function_call","name":"search_codebase","arguments":"{\\"query\\":\\"foo\\"}"}}',
        "",
      ].join("\n"),
      {
        conversation: "nexus:user:session",
        requestId: "req_987",
        streamedText: "",
      },
    );

    expect(result.events).toEqual([
      { event: "status", data: { text: "Hermes iniciou a ferramenta search_codebase.", tone: "info" } },
      {
        event: "meta",
        data: {
          provider: "hermes",
          event: "response.output_item.added",
          tool_name: "search_codebase",
          tool_state: "started",
        },
      },
    ]);
  });
});
