import { describe, expect, it } from "vitest";

import { parseHermesRunStatusPayload } from "./hermesRunStatus";

const context = {
  requestId: "req_123",
  runId: "run_123",
  sessionId: "nexus:session-1",
  streamedText: "",
};

describe("parseHermesRunStatusPayload", () => {
  it("mantem o run aberto quando o status ainda esta em execucao", () => {
    const result = parseHermesRunStatusPayload({
      run_id: "run_123",
      status: "running",
    }, context);

    expect(result.terminal).toBe(false);
    expect(result.parsed).toBeNull();
  });

  it("emite delta e done quando o status final contem output", () => {
    const result = parseHermesRunStatusPayload({
      run_id: "run_123",
      session_id: "nexus:session-1",
      status: "completed",
      output: "Configuração concluída.",
    }, context);

    expect(result.terminal).toBe(true);
    expect(result.parsed?.events).toEqual([
      { event: "delta", data: { delta: "Configuração concluída." } },
      {
        event: "meta",
        data: {
          provider: "hermes",
          event: "run.completed",
          run_id: "run_123",
          session_id: "nexus:session-1",
        },
      },
      { event: "done", data: { request_id: "req_123" } },
    ]);
  });

  it("emite erro final quando o run foi cancelado ou falhou", () => {
    const result = parseHermesRunStatusPayload({
      run_id: "run_123",
      status: "cancelled",
    }, context);

    expect(result.terminal).toBe(true);
    expect(result.parsed?.failed).toBe(true);
    expect(result.parsed?.events.at(-2)).toEqual({
      event: "error",
      data: "Falha ao executar o Hermes.",
    });
  });
});
