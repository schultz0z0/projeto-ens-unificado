import { describe, expect, it } from "vitest";

import { materializeHermesAttachments } from "./attachmentTransport";

describe("materializeHermesAttachments", () => {
  it("usa a url remota assinada para imagens quando o fallback remoto e solicitado", () => {
    const result = materializeHermesAttachments(
      [
        {
          kind: "image",
          name: "imagem.png",
          mime_type: "image/png",
          storage_path: "user/session/imagem.png",
          signed_url: "https://signed.example/imagem.png",
          original_signed_url: "https://signed.example/imagem.png",
          inline_data_url: "data:image/png;base64,abc",
        },
      ],
      "remote",
    );

    expect(result[0]?.signed_url).toBe("https://signed.example/imagem.png");
  });

  it("preserva extracted_text para documentos nao-imagem", () => {
    const result = materializeHermesAttachments([
      {
        kind: "file",
        name: "arquivo.docx",
        mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        storage_path: "user/session/arquivo.docx",
        signed_url: "https://signed.example/arquivo.docx",
        original_signed_url: "https://signed.example/arquivo.docx",
        inline_data_url: "data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,abc",
        extracted_text: "Primeiro paragrafo\nSegundo paragrafo",
      },
    ]);

    expect(result[0]).toMatchObject({
      kind: "file",
      name: "arquivo.docx",
      extracted_text: "Primeiro paragrafo\nSegundo paragrafo",
    });
  });
});
