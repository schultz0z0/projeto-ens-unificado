import { describe, expect, it, vi } from "vitest";

import { createHermesSession, deleteHermesSession } from "./hermesSessionsClient";

describe("hermesSessionsClient", () => {
  it("cria uma sessao Hermes usando a Sessions API", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "hsess_123", title: "Chat Nexus" }), { status: 200 }),
    );

    const session = await createHermesSession({
      hermesBaseUrl: new URL("https://hermes.example"),
      hermesApiKey: "secret",
      title: "Chat Nexus",
      fetchImpl,
    });

    expect(session).toEqual({ id: "hsess_123", title: "Chat Nexus" });
    expect(fetchImpl).toHaveBeenCalledWith(
      new URL("/api/sessions", "https://hermes.example"),
      expect.objectContaining({
        method: "POST",
      }),
    );
  });

  it("apaga a sessao Hermes e tolera 404 no cleanup", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(null, { status: 404 }));

    await expect(deleteHermesSession({
      hermesBaseUrl: new URL("https://hermes.example"),
      hermesApiKey: "secret",
      hermesSessionId: "hsess_123",
      fetchImpl,
    })).resolves.toBe(true);

    await expect(deleteHermesSession({
      hermesBaseUrl: new URL("https://hermes.example"),
      hermesApiKey: "secret",
      hermesSessionId: "hsess_404",
      fetchImpl,
    })).resolves.toBe(false);
  });
});
