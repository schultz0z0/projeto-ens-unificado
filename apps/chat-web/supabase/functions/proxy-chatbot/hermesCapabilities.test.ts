import { describe, expect, it } from "vitest";

import { assertHermesSessionCapabilities, buildHermesSessionKey, parseHermesCapabilities } from "./hermesCapabilities";

describe("buildHermesSessionKey", () => {
  it("monta X-Hermes-Session-Key estavel e sem caracteres proibidos", () => {
    expect(buildHermesSessionKey({
      userId: "user-123",
      sessionId: "session-456",
    })).toBe("agent:main:nexus:chat:user-123:session-456");
  });
});

describe("parseHermesCapabilities", () => {
  it("aceita responses_api=true no capabilities", () => {
    expect(parseHermesCapabilities({
      features: {
        responses_api: true,
        run_submission: true,
        run_events_sse: true,
        session_chat: true,
      },
      endpoints: {
        runs: "/v1/runs",
        run_events: "/v1/runs/{run_id}/events",
        session_chat_stream: "/api/sessions/{id}/chat/stream",
      },
      session_key_header: "X-Hermes-Session-Key",
    })).toEqual({
      responsesApi: true,
      runsApi: true,
      sessionsApi: true,
      sessionKeyHeader: "X-Hermes-Session-Key",
    });
  });

  it("falha quando a Sessions API nao esta anunciada", () => {
    expect(() => assertHermesSessionCapabilities({
      responsesApi: true,
      runsApi: false,
      sessionsApi: false,
      sessionKeyHeader: "X-Hermes-Session-Key",
    })).toThrow("hermes_sessions_api_not_supported");
  });
});
