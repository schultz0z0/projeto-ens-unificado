import { describe, expect, it } from "vitest";

import { buildHermesResponsesRequest } from "./hermesResponsesAdapter";

describe("buildHermesResponsesRequest", () => {
  it("monta payload /v1/responses com conversation e input_text/input_image corretos", () => {
    const request = buildHermesResponsesRequest({
      userId: "user-1",
      sessionId: "session-1",
      messageText: "analise a imagem",
      previousResponseId: "resp_prev",
      attachments: [
        {
          kind: "image",
          name: "imagem.png",
          mime_type: "image/png",
          storage_path: "user-1/session-1/imagem.png",
          signed_url: "https://signed.example/imagem.png",
        },
      ],
    });

    expect(request.conversation).toBe("nexus:user-1:session-1");
    expect(request.previous_response_id).toBe("resp_prev");
    expect(request.input[0]?.content[0]).toEqual({ type: "input_text", text: "analise a imagem" });
    expect(request.input[0]?.content[1]).toEqual({
      type: "input_image",
      image_url: "https://signed.example/imagem.png",
      detail: "auto",
    });
  });

  it("encadeia mensagens de replay multimodal antes do turno atual", () => {
    const request = buildHermesResponsesRequest({
      userId: "user-1",
      sessionId: "session-1",
      messageText: "o que voce viu antes?",
      attachments: [],
      replayContextMessages: [
        {
          messageText: "analise a imagem anterior",
          attachments: [
            {
              kind: "image",
              name: "imagem.png",
              mime_type: "image/png",
              storage_path: "user-1/session-1/imagem.png",
              signed_url: "https://signed.example/imagem.png",
            },
          ],
        },
      ],
    });

    expect(request.input).toEqual([
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: [
              "[Contexto multimodal anterior da conversa]",
              "Mensagem anterior do usuario: analise a imagem anterior",
            ].join("\n"),
          },
          {
            type: "input_image",
            image_url: "https://signed.example/imagem.png",
            detail: "auto",
          },
        ],
      },
      {
        role: "user",
        content: [{ type: "input_text", text: "o que voce viu antes?" }],
      },
    ]);
  });
});
