import { describe, expect, it } from "vitest";

import { isAllowedStreamFileUrl, isSafeRenderableImage, parseAllowedStreamFileHosts } from "./chatStreamFileSafety";

describe("isAllowedStreamFileUrl", () => {
  it("aceita arquivo do host permitido", () => {
    expect(
      isAllowedStreamFileUrl("https://murxwqdevpwjtnnuzzxi.supabase.co/storage/v1/object/sign/chat-attachments/file.png", [
        "murxwqdevpwjtnnuzzxi.supabase.co",
      ]),
    ).toBe(true);
  });

  it("rejeita url externa fora da allowlist", () => {
    expect(
      isAllowedStreamFileUrl("https://evil.example/file.png", ["murxwqdevpwjtnnuzzxi.supabase.co"]),
    ).toBe(false);
  });
});

describe("parseAllowedStreamFileHosts", () => {
  it("aceita hosts extras configurados como urls completas ou hosts puros", () => {
    expect(
      parseAllowedStreamFileHosts(
        "https://jhbakzkqamgddphwakjj.supabase.co, nexus-ai-ens.vercel.app https://cdn.example/assets",
      ),
    ).toEqual(["jhbakzkqamgddphwakjj.supabase.co", "nexus-ai-ens.vercel.app", "cdn.example"]);
  });
});

describe("isSafeRenderableImage", () => {
  it("nao renderiza svg remoto diretamente", () => {
    expect(isSafeRenderableImage({ kind: "image", name: "vector.svg", mimeType: "image/svg+xml" })).toBe(false);
  });
});
