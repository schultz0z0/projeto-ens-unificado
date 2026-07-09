import { describe, expect, it } from "vitest";

import { buildProfileWritePayload, getCorsHeaders } from "./adminCreateUserPolicy";

const makeRequest = (origin: string) =>
  new Request("https://murxwqdevpwjtnnuzzxi.supabase.co/functions/v1/admin-create-user", {
    method: "OPTIONS",
    headers: {
      Origin: origin,
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "authorization,x-client-info,apikey,content-type",
    },
  });

describe("admin-create-user CORS", () => {
  it("permite a origem oficial de producao mesmo quando ALLOWED_ORIGINS esta desatualizado", () => {
    const headers = getCorsHeaders(makeRequest("https://app.solucoes-nexus.tech"), "https://nexus-ai-ens.vercel.app");

    expect(headers["Access-Control-Allow-Origin"]).toBe("https://app.solucoes-nexus.tech");
  });

  it("permite o localhost usado no desenvolvimento mesmo quando ALLOWED_ORIGINS esta desatualizado", () => {
    const headers = getCorsHeaders(makeRequest("http://127.0.0.1:8085"), "https://app.solucoes-nexus.tech");

    expect(headers["Access-Control-Allow-Origin"]).toBe("http://127.0.0.1:8085");
  });
});

describe("admin-create-user profile payload", () => {
  it("preserva a role escolhida quando o profile ja existe por trigger do Auth", () => {
    const payload = buildProfileWritePayload({
      email: "amanda.silva@ens.edu.br",
      fullName: "Amanda Silva",
      role: "manager",
      updatedAt: "2026-07-09T12:00:00.000Z",
    });

    expect(payload).toEqual({
      full_name: "Amanda Silva",
      email: "amanda.silva@ens.edu.br",
      role: "manager",
      updated_at: "2026-07-09T12:00:00.000Z",
    });
  });
});
