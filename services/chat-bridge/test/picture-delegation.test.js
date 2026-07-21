import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { decodeJwt } from "jose";

import { buildPictureDelegationSystemMessage, issuePictureDelegation, redactPictureDelegation } from "../src/picture-delegation.js";

const config = { activeKid: "v2", activeKey: "picture-delegation-key-at-least-32-bytes", issuer: "nexus-chat-bridge", audience: "nexus-picture", ttlSeconds: 90 };

test("issues complete short-lived Picture claims bound to one workspace", async () => {
  const token = await issuePictureDelegation({
    userId: randomUUID(), tenantId: "ens", role: "member", chatSessionId: randomUUID(), workspaceId: randomUUID(), runId: randomUUID(),
  }, ["picture:read", "picture:write"], config);
  const claims = decodeJwt(token);
  for (const claim of ["sub", "tenant_id", "actor_role", "chat_session_id", "workspace_id", "run_id", "scopes", "jti", "iat", "nbf", "exp", "contract_version"]) {
    assert.notEqual(claims[claim], undefined, claim);
  }
  assert.ok(claims.exp - claims.iat <= 90);
});

test("technical delegation is system-only and redacted recursively", () => {
  const token = "header.payload.signature";
  const message = buildPictureDelegationSystemMessage(token);
  assert.match(message, /PICTURE_DELEGATION/);
  assert.match(message, /header\.payload\.signature/);
  assert.equal(redactPictureDelegation(`hello\n${message}`), "hello");
  assert.deepEqual(redactPictureDelegation({ delegation_token: token, nested: { authorization: token }, safe: "ok" }), {
    delegation_token: "[REDACTED]", nested: { authorization: "[REDACTED]" }, safe: "ok",
  });
});
