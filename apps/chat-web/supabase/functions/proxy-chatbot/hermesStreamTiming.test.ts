import { describe, expect, it } from "vitest";

import {
  DEFAULT_HERMES_STREAM_HEARTBEAT_MS,
  DEFAULT_HERMES_STREAM_TIMEOUT_MS,
  resolveHermesStreamTiming,
} from "./hermesStreamTiming";

const createEnv = (values: Record<string, string | undefined>) => ({
  get: (key: string) => values[key],
});

describe("resolveHermesStreamTiming", () => {
  it("nao aplica timeout proprio por padrao e mantem heartbeat ativo", () => {
    expect(resolveHermesStreamTiming(createEnv({}))).toEqual({
      timeoutMs: DEFAULT_HERMES_STREAM_TIMEOUT_MS,
      heartbeatMs: DEFAULT_HERMES_STREAM_HEARTBEAT_MS,
    });
    expect(DEFAULT_HERMES_STREAM_TIMEOUT_MS).toBe(0);
    expect(DEFAULT_HERMES_STREAM_HEARTBEAT_MS).toBe(15_000);
  });

  it("aceita override por env e rejeita valores baixos demais", () => {
    expect(resolveHermesStreamTiming(createEnv({
      HERMES_STREAM_TIMEOUT_MS: "120000",
      HERMES_STREAM_HEARTBEAT_MS: "1000",
    }))).toEqual({
      timeoutMs: 120_000,
      heartbeatMs: 5_000,
    });
  });

  it("permite desabilitar timeout e heartbeat explicitamente com zero", () => {
    expect(resolveHermesStreamTiming(createEnv({
      HERMES_STREAM_TIMEOUT_MS: "0",
      HERMES_STREAM_HEARTBEAT_MS: "0",
    }))).toEqual({
      timeoutMs: 0,
      heartbeatMs: 0,
    });
  });
});
