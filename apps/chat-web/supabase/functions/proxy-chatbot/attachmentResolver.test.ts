import { describe, expect, it } from "vitest";

import { resolveAttachmentForUser } from "./attachmentResolver";

const buildSupabaseAdmin = (content = "Arquivo de teste") => ({
  storage: {
    from: () => ({
      download: async () => ({
        data: new Blob([content], { type: "text/plain" }),
        error: null,
      }),
      createSignedUrl: async () => ({
        data: { signedUrl: "https://signed.example/file.txt" },
        error: null,
      }),
    }),
  },
});

describe("resolveAttachmentForUser", () => {
  it("rejeita storage_path fora do escopo do usuario", async () => {
    await expect(
      resolveAttachmentForUser({
        supabaseAdmin: buildSupabaseAdmin(),
        userId: "user-1",
        sessionId: "session-1",
        attachment: {
          kind: "file",
          name: "arquivo.txt",
          mime_type: "text/plain",
          storage_path: "user-2/session-1/arquivo.txt",
        },
      }),
    ).rejects.toThrow("forbidden_attachment");
  });

  it("rejeita mime type nao permitido", async () => {
    await expect(
      resolveAttachmentForUser({
        supabaseAdmin: buildSupabaseAdmin(),
        userId: "user-1",
        sessionId: "session-1",
        attachment: {
          kind: "file",
          name: "arquivo.exe",
          mime_type: "application/x-msdownload",
          storage_path: "user-1/session-1/arquivo.exe",
        },
      }),
    ).rejects.toThrow("invalid_attachment_mime");
  });

  it("resolve o anexo com signed url server-side, inline data e texto extraido", async () => {
    const result = await resolveAttachmentForUser({
      supabaseAdmin: buildSupabaseAdmin("Linha 1\nLinha 2"),
      userId: "user-1",
      sessionId: "session-1",
      attachment: {
        kind: "file",
        name: "arquivo.txt",
        mime_type: "text/plain",
        storage_path: "user-1/session-1/arquivo.txt",
      },
    });

    expect(result.original_signed_url).toBe("https://signed.example/file.txt");
    expect(result.inline_data_url.startsWith("data:text/plain;base64,")).toBe(true);
    expect(result.extracted_text).toContain("Linha 1");
  });
});
