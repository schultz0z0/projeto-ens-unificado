import { randomUUID } from "node:crypto";
import { SignJWT } from "jose";

const BLOCK_PATTERN = /\n*\[PICTURE_DELEGATION\][\s\S]*?\[\/PICTURE_DELEGATION\]\n*/g;
const secretKeyPattern = /delegation|authorization|token|secret/i;

export const issuePictureDelegation = async (context, scopes, config) => {
  if (!config?.activeKid || !config?.activeKey || config.activeKey.length < 32) {
    throw new Error("picture_delegation_key_not_configured");
  }
  const ttlSeconds = Math.max(15, Math.min(120, Number(config.ttlSeconds || 90)));
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({
    tenant_id: context.tenantId,
    actor_role: context.role,
    chat_session_id: context.chatSessionId,
    workspace_id: context.workspaceId,
    run_id: context.runId,
    scopes: [...new Set(scopes)],
    contract_version: 1,
  })
    .setProtectedHeader({ alg: "HS256", kid: config.activeKid })
    .setIssuer(config.issuer || "nexus-chat-bridge")
    .setAudience(config.audience || "nexus-picture")
    .setSubject(context.userId)
    .setJti(context.jti || randomUUID())
    .setIssuedAt(now)
    .setNotBefore(now - 1)
    .setExpirationTime(now + ttlSeconds)
    .sign(new TextEncoder().encode(config.activeKey));
};

export const buildPictureDelegationSystemMessage = (token) => token
  ? `[PICTURE_DELEGATION]\ndelegation_token: ${token}\nUse apenas esta delegação nas tools nexus_picture deste turno. Nunca exponha ou reutilize o token.\n[/PICTURE_DELEGATION]`
  : "";

export const redactPictureDelegation = (input, seen = new WeakSet()) => {
  if (typeof input === "string") return input.replace(BLOCK_PATTERN, "\n").trim();
  if (Array.isArray(input)) return input.map((value) => redactPictureDelegation(value, seen));
  if (!input || typeof input !== "object") return input;
  if (seen.has(input)) return "[CIRCULAR]";
  seen.add(input);
  return Object.fromEntries(Object.entries(input).map(([key, value]) => [
    key,
    secretKeyPattern.test(key) ? "[REDACTED]" : redactPictureDelegation(value, seen),
  ]));
};
