import { describe, expect, it } from "vitest";

import { extractReplayContextFromHistory } from "./multimodalContextMemory";

const buildStructuredMessage = (parts: unknown[]) =>
  `[[NEXUS_CHAT_MESSAGE]]\n${JSON.stringify({ v: 2, parts })}\n[[/NEXUS_CHAT_MESSAGE]]`;

describe("extractReplayContextFromHistory", () => {
  it("extrai o turno multimodal mais recente de mensagens persistidas do usuario", () => {
    const result = extractReplayContextFromHistory({
      messages: [
        {
          role: "assistant",
          created_at: "2026-05-29T10:00:03.000Z",
          content: "Claro, vou analisar.",
        },
        {
          role: "user",
          created_at: "2026-05-29T10:00:00.000Z",
          content: buildStructuredMessage([
            {
              id: "text-1",
              type: "text",
              text: "Analise esta imagem e o documento",
            },
            {
              id: "file-1",
              type: "file",
              kind: "image",
              name: "imagem.png",
              url: "https://signed.example/imagem.png",
              mimeType: "image/png",
              storagePath: "user/session/imagem.png",
            },
            {
              id: "file-2",
              type: "file",
              kind: "file",
              name: "contrato.pdf",
              url: "https://signed.example/contrato.pdf",
              mimeType: "application/pdf",
              storagePath: "user/session/contrato.pdf",
            },
          ]),
        },
      ],
    });

    expect(result).toEqual([
      {
        messageText: "Analise esta imagem e o documento",
        attachments: [
          {
            kind: "image",
            name: "imagem.png",
            mime_type: "image/png",
            storage_path: "user/session/imagem.png",
          },
          {
            kind: "file",
            name: "contrato.pdf",
            mime_type: "application/pdf",
            storage_path: "user/session/contrato.pdf",
          },
        ],
      },
    ]);
  });

  it("ignora anexos do turno atual e respeita o limite maximo de replay", () => {
    const result = extractReplayContextFromHistory({
      messages: [
        {
          role: "user",
          created_at: "2026-05-29T10:05:00.000Z",
          content: buildStructuredMessage([
            {
              id: "text-2",
              type: "text",
              text: "Use a planilha anterior",
            },
            {
              id: "file-3",
              type: "file",
              kind: "file",
              name: "planilha.xlsx",
              url: "https://signed.example/planilha.xlsx",
              mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
              storagePath: "user/session/planilha.xlsx",
            },
          ]),
        },
        {
          role: "user",
          created_at: "2026-05-29T10:00:00.000Z",
          content: buildStructuredMessage([
            {
              id: "file-4",
              type: "file",
              kind: "file",
              name: "atual.docx",
              url: "https://signed.example/atual.docx",
              mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
              storagePath: "user/session/atual.docx",
            },
          ]),
        },
      ],
      currentTurnStoragePaths: ["user/session/atual.docx"],
      maxMessages: 1,
      maxAttachments: 1,
    });

    expect(result).toEqual([
      {
        messageText: "Use a planilha anterior",
        attachments: [
          {
            kind: "file",
            name: "planilha.xlsx",
            mime_type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            storage_path: "user/session/planilha.xlsx",
          },
        ],
      },
    ]);
  });
});
