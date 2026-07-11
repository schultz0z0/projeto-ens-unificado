import { randomUUID } from "node:crypto";
import { SignJWT } from "jose";

const BLOCK_PATTERN = /\n*\[MARKETING_OPS_DELEGATION\][\s\S]*?\[\/MARKETING_OPS_DELEGATION\]\n*/g;
const secretKeyPattern = /delegation|authorization|token|secret/i;

const defaultConfig = () => ({
  activeKid: process.env.MARKETING_OPS_DELEGATION_ACTIVE_KID || "",
  activeKey: process.env.MARKETING_OPS_DELEGATION_ACTIVE_KEY || "",
  issuer: process.env.MARKETING_OPS_DELEGATION_ISSUER || "nexus-chat-bridge",
  audience: process.env.MARKETING_OPS_DELEGATION_AUDIENCE || "nexus-marketing-ops",
  ttlSeconds: Number(process.env.MARKETING_OPS_DELEGATION_TTL_SECONDS || 90),
});

export const issueMarketingOpsDelegation = async (context, scopes, config = defaultConfig()) => {
  if (!config.activeKid || !config.activeKey || config.activeKey.length < 32) {
    throw new Error("marketing_ops_delegation_key_not_configured");
  }
  const ttlSeconds = Math.max(15, Math.min(120, Number(config.ttlSeconds || 90)));
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({
    tenant_id: context.tenantId,
    actor_role: context.role,
    scopes: [...new Set(scopes)],
    chat_session_id: context.chatSessionId,
    run_id: context.runId,
    correlation_id: context.correlationId,
    contract_version: 1,
  })
    .setProtectedHeader({ alg: "HS256", kid: config.activeKid })
    .setIssuer(config.issuer)
    .setAudience(config.audience)
    .setSubject(context.userId)
    .setJti(randomUUID())
    .setIssuedAt(now)
    .setNotBefore(now - 1)
    .setExpirationTime(now + ttlSeconds)
    .sign(new TextEncoder().encode(config.activeKey));
};

export const withMarketingOpsDelegation = (message, token) => {
  const normalized = String(message ?? "").trim();
  if (!token) return normalized;
  return `${normalized}\n\n[MARKETING_OPS_DELEGATION]\ndelegation_token: ${token}\nUse this token only as the delegation_token argument for nexus_marketing_ops tools.\n[/MARKETING_OPS_DELEGATION]`;
};

export const redactMarketingOpsDelegation = (input, seen = new WeakSet()) => {
  if (typeof input === "string") return input.replace(BLOCK_PATTERN, "\n").trim();
  if (Array.isArray(input)) return input.map((item) => redactMarketingOpsDelegation(item, seen));
  if (!input || typeof input !== "object") return input;
  if (seen.has(input)) return "[CIRCULAR]";
  seen.add(input);
  return Object.fromEntries(Object.entries(input).map(([key, nested]) => [
    key,
    secretKeyPattern.test(key) ? "[REDACTED]" : redactMarketingOpsDelegation(nested, seen),
  ]));
};
