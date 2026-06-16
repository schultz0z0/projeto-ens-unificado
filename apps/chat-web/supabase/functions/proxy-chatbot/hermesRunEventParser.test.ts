import { describe, expect, it } from "vitest";

import { parseHermesRunEventBlock } from "./hermesRunEventParser";

describe("parseHermesRunEventBlock", () => {
  it("emite delta a partir de message.delta", () => {
    const result = parseHermesRunEventBlock(
      'data: {"event":"message.delta","run_id":"run_123","delta":"Oi"}',
      {
        requestId: "req_123",
        runId: "run_123",
        sessionId: "session-1",
        streamedText: "",
      },
    );

    expect(result).toEqual({
      events: [{ event: "delta", data: { delta: "Oi" } }],
      streamedText: "Oi",
      completed: false,
      failed: false,
      errorCode: null,
    });
  });

  it("emite delta a partir de assistant.delta", () => {
    const result = parseHermesRunEventBlock(
      'data: {"event":"assistant.delta","run_id":"run_123","delta":"Oi"}',
      {
        requestId: "req_123",
        runId: "run_123",
        sessionId: "session-1",
        streamedText: "",
      },
    );

    expect(result).toEqual({
      events: [{ event: "delta", data: { delta: "Oi" } }],
      streamedText: "Oi",
      completed: false,
      failed: false,
      errorCode: null,
    });
  });

  it("emite delta faltante quando o assistant completa com content", () => {
    const result = parseHermesRunEventBlock(
      'data: {"event":"assistant.completed","run_id":"run_123","session_id":"session-1","content":"Ola mundo"}',
      {
        requestId: "req_123",
        runId: "run_123",
        sessionId: "session-1",
        streamedText: "Ola",
      },
    );

    expect(result.events).toEqual([
      { event: "delta", data: { delta: " mundo" } },
      {
        event: "meta",
        data: {
          provider: "hermes",
          event: "assistant.completed",
          run_id: "run_123",
          session_id: "session-1",
        },
      },
    ]);
    expect(result.streamedText).toBe("Ola mundo");
    expect(result.completed).toBe(false);
  });

  it("emite arquivo de imagem gerada a partir de image_url na Runs API", () => {
    const result = parseHermesRunEventBlock(
      'data: {"event":"tool.completed","run_id":"run_123","tool_name":"image_gen","result":{"image_url":"https://nexus-ai-ens.vercel.app/generated/nano-banana.png","mime_type":"image/png","filename":"nano-banana.png"}}',
      {
        requestId: "req_123",
        runId: "run_123",
        sessionId: "session-1",
        streamedText: "",
      },
    );

    expect(result.events).toEqual([
      { event: "status", data: { text: "Hermes concluiu a ferramenta image_gen.", tone: "success" } },
      {
        event: "files",
        data: {
          files: [
            {
              name: "nano-banana.png",
              url: "https://nexus-ai-ens.vercel.app/generated/nano-banana.png",
              kind: "image",
              mimeType: "image/png",
            },
          ],
        },
      },
      {
        event: "meta",
        data: {
          provider: "hermes",
          event: "tool.completed",
          run_id: "run_123",
          session_id: "session-1",
        },
      },
    ]);
  });

  it("emite arquivos comuns aninhados sem duplicar URLs", () => {
    const result = parseHermesRunEventBlock(
      'data: {"event":"assistant.completed","run_id":"run_123","files":[{"url":"https://nexus-ai-ens.vercel.app/generated/report.pdf","name":"report.pdf","mimeType":"application/pdf"},{"download_url":"https://nexus-ai-ens.vercel.app/generated/report.pdf","filename":"report.pdf","mime_type":"application/pdf"}],"content":"Arquivo pronto."}',
      {
        requestId: "req_123",
        runId: "run_123",
        sessionId: "session-1",
        streamedText: "",
      },
    );

    expect(result.events).toEqual([
      { event: "delta", data: { delta: "Arquivo pronto." } },
      {
        event: "files",
        data: {
          files: [
            {
              name: "report.pdf",
              url: "https://nexus-ai-ens.vercel.app/generated/report.pdf",
              kind: "file",
              mimeType: "application/pdf",
            },
          ],
        },
      },
      {
        event: "meta",
        data: {
          provider: "hermes",
          event: "assistant.completed",
          run_id: "run_123",
          session_id: "session-1",
        },
      },
    ]);
  });

  it("emite delta faltante e done quando o run completa", () => {
    const result = parseHermesRunEventBlock(
      'data: {"event":"run.completed","run_id":"run_123","session_id":"session-1","output":"Ola mundo"}',
      {
        requestId: "req_123",
        runId: "run_123",
        sessionId: "session-1",
        streamedText: "Ola",
      },
    );

    expect(result.events).toEqual([
      { event: "delta", data: { delta: " mundo" } },
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
    expect(result.streamedText).toBe("Ola mundo");
    expect(result.completed).toBe(true);
  });

  it("normaliza falhas do run sem expor payload bruto", () => {
    const result = parseHermesRunEventBlock(
      'data: {"event":"run.failed","run_id":"run_123","error":{"message":"Tool failed loudly"}}',
      {
        requestId: "req_123",
        runId: "run_123",
        sessionId: "session-1",
        streamedText: "",
      },
    );

    expect(result.events).toEqual([
      {
        event: "meta",
        data: {
          provider: "hermes",
          event: "run.failed",
          run_id: "run_123",
          session_id: "session-1",
          error_code: "tool_failed_loudly",
          upstream_error_excerpt: "Tool failed loudly",
        },
      },
      { event: "error", data: "Falha ao executar o Hermes." },
      { event: "done", data: { request_id: "req_123" } },
    ]);
    expect(result.failed).toBe(true);
  });
});
