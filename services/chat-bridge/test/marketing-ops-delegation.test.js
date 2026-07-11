import assert from "node:assert/strict";
import test from "node:test";
import { decodeProtectedHeader, jwtVerify } from "jose";

import { validateBridgeRuntimeConfig } from "../src/runtime-config.js";
import {
  issueMarketingOpsDelegation,
  redactMarketingOpsDelegation,
  withMarketingOpsDelegation,
} from "../src/marketing-ops-delegation.js";

test("production fails closed without Supabase and delegation config", () => {
  assert.throws(() => validateBridgeRuntimeConfig({ NODE_ENV: "production" }), /SUPABASE_URL/);
});

test("local auth fallback requires an explicit flag", () => {
  assert.throws(() => validateBridgeRuntimeConfig({ NODE_ENV: "development" }), /BRIDGE_ALLOW_INSECURE_LOCAL_AUTH/);
  const config = validateBridgeRuntimeConfig({ NODE_ENV: "development", BRIDGE_ALLOW_INSECURE_LOCAL_AUTH: "true" });
  assert.equal(config.allowInsecureLocalAuth, true);
});

test("delegation has exact short-lived claims and active kid", async () => {
  const key = "bridge-active-delegation-key-at-least-32-bytes";
  const signed = await issueMarketingOpsDelegation({
    userId: "11111111-1111-4111-8111-111111111111",
    tenantId: "ens",
    role: "member",
    chatSessionId: "22222222-2222-4222-8222-222222222222",
    runId: "33333333-3333-4333-8333-333333333333",
    correlationId: "44444444-4444-4444-8444-444444444444",
  }, ["campaign:read", "campaign:write"], {
    activeKid: "v2", activeKey: key, issuer: "nexus-chat-bridge", audience: "nexus-marketing-ops", ttlSeconds: 90,
  });
  assert.equal(decodeProtectedHeader(signed).kid, "v2");
  const verified = await jwtVerify(signed, new TextEncoder().encode(key), { issuer: "nexus-chat-bridge", audience: "nexus-marketing-ops" });
  assert.equal(verified.payload.sub, "11111111-1111-4111-8111-111111111111");
  assert.equal(verified.payload.tenant_id, "ens");
  assert.equal(verified.payload.actor_role, "member");
  assert.equal(verified.payload.exp - verified.payload.iat, 90);
});

test("technical delegation is redacted before persistence or logging", () => {
  const fakeToken = "eyJhbGciOiJIUzI1NiIsImtpZCI6InYyIn0.payload.signature";
  const message = withMarketingOpsDelegation("Create a campaign", fakeToken);
  assert.match(message, /MARKETING_OPS_DELEGATION/);
  assert.equal(redactMarketingOpsDelegation(message), "Create a campaign");
  const redactedObject = redactMarketingOpsDelegation({ input: message, delegation_token: fakeToken, safe: "kept" });
  assert.deepEqual(redactedObject, { input: "Create a campaign", delegation_token: "[REDACTED]", safe: "kept" });
});
