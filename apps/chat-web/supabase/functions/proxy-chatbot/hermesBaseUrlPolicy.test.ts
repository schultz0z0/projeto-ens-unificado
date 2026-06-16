import { describe, expect, it } from "vitest";

import { validateHermesBaseUrl } from "./hermesBaseUrlPolicy";

describe("validateHermesBaseUrl", () => {
  it("aceita o host padrao quando nao ha allowlist explicita", () => {
    const url = validateHermesBaseUrl("https://hermes.example.com", "", "https://hermes.example.com");
    expect(url.origin).toBe("https://hermes.example.com");
  });

  it("rejeita host arbitrario fora do host padrao e da allowlist", () => {
    expect(() =>
      validateHermesBaseUrl("https://evil.example.com", "", "https://hermes.example.com"),
    ).toThrow("invalid_env:HERMES_BASE_URL_NOT_ALLOWED");
  });
});
