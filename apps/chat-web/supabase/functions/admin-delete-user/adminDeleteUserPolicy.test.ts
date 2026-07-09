import { describe, expect, it } from "vitest";

import { getCorsHeaders } from "./adminDeleteUserPolicy";

const makeRequest = (origin: string) =>
  new Request("https://murxwqdevpwjtnnuzzxi.supabase.co/functions/v1/admin-delete-user", {
    method: "OPTIONS",
    headers: {
      Origin: origin,
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "authorization,x-client-info,apikey,content-type",
    },
  });

describe("admin-delete-user CORS", () => {
  it("permite a origem oficial de producao mesmo quando ALLOWED_ORIGINS esta desatualizado", () => {
    const headers = getCorsHeaders(makeRequest("https://app.solucoes-nexus.tech"), "https://nexus-ai-ens.vercel.app");

    expect(headers["Access-Control-Allow-Origin"]).toBe("https://app.solucoes-nexus.tech");
  });

  it("permite o localhost usado no desenvolvimento mesmo quando ALLOWED_ORIGINS esta desatualizado", () => {
    const headers = getCorsHeaders(makeRequest("http://127.0.0.1:8085"), "https://app.solucoes-nexus.tech");

    expect(headers["Access-Control-Allow-Origin"]).toBe("http://127.0.0.1:8085");
  });
});
