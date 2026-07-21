import { expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { SignJWT } from "jose";

const ACTIVE = "active-picture-delegation-key-at-least-32-bytes";
const PREVIOUS = "previous-picture-delegation-key-at-least-32-bytes";
const WORKSPACE = "11111111-1111-4111-8111-111111111111";
const keyring = {
  activeKid: "v2",
  activeKey: ACTIVE,
  previousKid: "v1",
  previousKey: PREVIOUS,
  issuer: "nexus-chat-bridge",
  audience: "nexus-picture",
  maxTtlSeconds: 120,
};

const token = async (overrides: Record<string, unknown> = {}, options: { key?: string; kid?: string; issuer?: string; audience?: string; issuedAt?: number; ttl?: number } = {}) => {
  const now = options.issuedAt ?? Math.floor(Date.now() / 1000);
  return new SignJWT({
    tenant_id: "ens",
    actor_role: "member",
    chat_session_id: randomUUID(),
    workspace_id: WORKSPACE,
    run_id: randomUUID(),
    scopes: ["picture:read", "picture:write"],
    contract_version: 1,
    ...overrides,
  })
    .setProtectedHeader({ alg: "HS256", kid: options.kid ?? "v2" })
    .setIssuer(options.issuer ?? "nexus-chat-bridge")
    .setAudience(options.audience ?? "nexus-picture")
    .setSubject("22222222-2222-4222-8222-222222222222")
    .setJti(randomUUID())
    .setIssuedAt(now)
    .setNotBefore(now - 1)
    .setExpirationTime(now + (options.ttl ?? 60))
    .sign(new TextEncoder().encode(options.key ?? ACTIVE));
};

test("verifies complete claims with active and previous key", async () => {
  const { verifyPictureDelegation } = await import("../src/service/delegation.ts");
  const active = await verifyPictureDelegation(await token(), ["picture:read"], { keyring, workspaceId: WORKSPACE });
  const previous = await verifyPictureDelegation(await token({}, { key: PREVIOUS, kid: "v1" }), ["picture:write"], { keyring, workspaceId: WORKSPACE });
  expect(active).toMatchObject({ userId: "22222222-2222-4222-8222-222222222222", tenantId: "ens", workspaceId: WORKSPACE });
  expect(previous.scopes).toContain("picture:write");
});

test("rejects expiry, wrong issuer and audience", async () => {
  const { verifyPictureDelegation } = await import("../src/service/delegation.ts");
  await expect(verifyPictureDelegation(await token({}, { issuedAt: Math.floor(Date.now() / 1000) - 300, ttl: 30 }), [], { keyring })).rejects.toMatchObject({ code: "picture_delegation_invalid" });
  await expect(verifyPictureDelegation(await token({}, { issuer: "other" }), [], { keyring })).rejects.toMatchObject({ code: "picture_delegation_invalid" });
  await expect(verifyPictureDelegation(await token({}, { audience: "other" }), [], { keyring })).rejects.toMatchObject({ code: "picture_delegation_invalid" });
});

test("rejects workspace substitution, insufficient scope and excessive lifetime", async () => {
  const { verifyPictureDelegation } = await import("../src/service/delegation.ts");
  await expect(verifyPictureDelegation(await token(), [], { keyring, workspaceId: randomUUID() })).rejects.toMatchObject({ code: "picture_delegation_workspace_denied" });
  await expect(verifyPictureDelegation(await token({ scopes: ["picture:read"] }), ["picture:write"], { keyring })).rejects.toMatchObject({ code: "picture_delegation_scope_denied" });
  await expect(verifyPictureDelegation(await token({}, { ttl: 300 }), [], { keyring })).rejects.toMatchObject({ code: "picture_delegation_invalid" });
});
