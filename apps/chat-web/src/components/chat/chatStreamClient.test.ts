import { afterEach, describe, expect, it, vi } from "vitest";

import { sendMessageToChatbotStream } from "./chatStreamClient";

const jsonResponse = (payload: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });

describe("sendMessageToChatbotStream", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("recovers completed run events from snapshot when the events stream fetch fails", async () => {
    vi.useFakeTimers();
    vi.stubEnv("VITE_CHAT_STREAM_FILE_HOSTS", "arquivos.solucoes-nexus.tech");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ run: { id: "run-1" } }, { status: 202 }))
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(
        jsonResponse({
          run: {
            status: "completed",
            events: [
              { event: "delta", data: "Imagem pronta." },
              {
                event: "files",
                data: {
                  files: [
                    {
                      name: "render.png",
                      url: "https://arquivos.solucoes-nexus.tech/v1/artifacts/artifact-1/content?token=abc",
                      kind: "image",
                      mimeType: "image/png",
                      artifact_id: "artifact-1",
                    },
                  ],
                },
              },
              { event: "done", data: {} },
            ],
          },
        }),
      );

    vi.stubGlobal("fetch", fetchMock);
    const deltas: string[] = [];
    const files: unknown[] = [];

    const promise = sendMessageToChatbotStream({
      payload: { session_id: "chat-1", message_text: "gere uma imagem" },
      getAccessToken: async () => "token-1",
      refreshAccessToken: async () => null,
      signOut: async () => {},
      resolveChatbotProxyBaseUrl: () => "https://bridge.solucoes-nexus.tech",
      onDelta: (delta) => deltas.push(delta),
      onFiles: (items) => files.push(...items),
    });

    await vi.runAllTimersAsync();
    await promise;

    expect(deltas).toEqual(["Imagem pronta."]);
    expect(files).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
