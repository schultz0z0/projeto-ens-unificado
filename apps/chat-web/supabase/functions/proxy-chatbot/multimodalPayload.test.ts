import { describe, expect, it } from "vitest";

import { buildHermesInput, buildHermesPdfFallbackInput, proxyChatRequestSchema } from "./multimodalPayload";

describe("proxyChatRequestSchema", () => {
  it("aceita texto simples ou anexos estruturados", () => {
    const result = proxyChatRequestSchema.safeParse({
      session_id: "session-1",
      message_text: "analise",
      attachments: [
        {
          kind: "image",
          name: "imagem.png",
          mime_type: "image/png",
          storage_path: "user/session/imagem.png",
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  it("rejeita attachment sem storage_path valido", () => {
    const result = proxyChatRequestSchema.safeParse({
      session_id: "session-1",
      message_text: "",
      attachments: [
        {
          kind: "image",
          name: "imagem.png",
          mime_type: "image/png",
          storage_path: "",
        },
      ],
    });

    expect(result.success).toBe(false);
  });
});

describe("buildHermesInput", () => {
  it("monta input_text + input_image para anexos de imagem", () => {
    const result = buildHermesInput({
      messageText: "analise a imagem",
      attachments: [
        {
          kind: "image",
          name: "imagem.png",
          mime_type: "image/png",
          storage_path: "user/session/imagem.png",
          signed_url: "https://signed-url/image",
        },
      ],
    });

    expect(result).toEqual([
      {
        role: "user",
        content: [
          { type: "input_text", text: "analise a imagem" },
          { type: "input_image", image_url: "https://signed-url/image", detail: "auto" },
        ],
      },
    ]);
  });

  it("monta input_file para pdf no caminho nativo", () => {
    const result = buildHermesInput({
      messageText: "analise o pdf",
      attachments: [
        {
          kind: "file",
          name: "arquivo.pdf",
          mime_type: "application/pdf",
          storage_path: "user/session/arquivo.pdf",
          signed_url: "https://signed-url/pdf",
          extracted_text: "Linha 1 do PDF. Linha 2 do PDF.",
        },
      ],
    });

    expect(result).toEqual([
      {
        role: "user",
        content: [
          { type: "input_text", text: "analise o pdf" },
          {
            type: "input_text",
            text: ["[Arquivo: arquivo.pdf]", "Linha 1 do PDF. Linha 2 do PDF."].join("\n"),
          },
        ],
      },
    ]);
  });

  it("monta input_text estruturado para documentos textuais extraidos", () => {
    const result = buildHermesInput({
      messageText: "analise o documento",
      attachments: [
        {
          kind: "file",
          name: "arquivo.docx",
          mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          storage_path: "user/session/arquivo.docx",
          signed_url: "https://signed-url/docx",
          extracted_text: "Primeiro paragrafo\nSegundo paragrafo",
        },
      ],
    });

    expect(result).toEqual([
      {
        role: "user",
        content: [
          { type: "input_text", text: "analise o documento" },
          {
            type: "input_text",
            text: ["[Arquivo: arquivo.docx]", "Primeiro paragrafo\nSegundo paragrafo"].join("\n"),
          },
        ],
      },
    ]);
  });

  it("mantem texto puro quando nao ha anexos", () => {
    const result = buildHermesInput({
      messageText: "ola",
      attachments: [],
    });

    expect(result).toEqual([
      {
        role: "user",
        content: [{ type: "input_text", text: "ola" }],
      },
    ]);
  });

  it("inclui contexto multimodal anterior antes da pergunta atual quando houver replay", () => {
    const result = buildHermesInput({
      messageText: "o que voce viu nessa imagem antes?",
      attachments: [],
      replayContextMessages: [
        {
          messageText: "analise esta imagem e o contrato",
          attachments: [
            {
              kind: "image",
              name: "imagem.png",
              mime_type: "image/png",
              storage_path: "user/session/imagem.png",
              signed_url: "https://signed-url/imagem",
            },
            {
              kind: "file",
              name: "contrato.pdf",
              mime_type: "application/pdf",
              storage_path: "user/session/contrato.pdf",
              signed_url: "https://signed-url/contrato",
              extracted_text: "Clausula 1. Clausula 2.",
            },
          ],
        },
      ],
    });

    expect(result).toEqual([
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: [
              "[Contexto multimodal anterior da conversa]",
              "Mensagem anterior do usuario: analise esta imagem e o contrato",
            ].join("\n"),
          },
          { type: "input_image", image_url: "https://signed-url/imagem", detail: "auto" },
          {
            type: "input_text",
            text: ["[Arquivo: contrato.pdf]", "Clausula 1. Clausula 2."].join("\n"),
          },
        ],
      },
      {
        role: "user",
        content: [{ type: "input_text", text: "o que voce viu nessa imagem antes?" }],
      },
    ]);
  });

  it("monta fallback textual efemero para pdf quando o caminho nativo falha", () => {
    const result = buildHermesPdfFallbackInput({
      messageText: "resuma o pdf",
      pdfFiles: [
        {
          name: "arquivo.pdf",
          extractedText: "Linha 1 do PDF. Linha 2 do PDF.",
        },
      ],
    });

    expect(result).toEqual([
      {
        role: "user",
        content: [
          { type: "input_text", text: "resuma o pdf" },
          {
            type: "input_text",
            text: [
              "[PDF: arquivo.pdf]",
              "Linha 1 do PDF. Linha 2 do PDF.",
            ].join("\n"),
          },
        ],
      },
    ]);
  });
});
