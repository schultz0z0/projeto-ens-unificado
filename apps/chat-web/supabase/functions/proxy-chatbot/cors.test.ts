import { describe, expect, it } from "vitest";

import { resolveAllowedOrigin } from "./cors";

describe("resolveAllowedOrigin", () => {
  it("aceita localhost e 127.0.0.1 como equivalentes na mesma porta", () => {
    const result = resolveAllowedOrigin("http://127.0.0.1:8081", [
      "http://localhost:8081",
      "https://nexus-ai-ens.vercel.app",
    ]);

    expect(result).toBe("http://127.0.0.1:8081");
  });

  it("aceita loopback local mesmo quando a porta muda no dev", () => {
    const result = resolveAllowedOrigin("http://127.0.0.1:4173", [
      "http://localhost:8081",
      "https://nexus-ai-ens.vercel.app",
    ]);

    expect(result).toBe("http://127.0.0.1:4173");
  });

  it("mantem a origem de producao explicitamente permitida", () => {
    const result = resolveAllowedOrigin("https://nexus-ai-ens.vercel.app", [
      "http://localhost:8081",
      "https://nexus-ai-ens.vercel.app",
    ]);

    expect(result).toBe("https://nexus-ai-ens.vercel.app");
  });
});
