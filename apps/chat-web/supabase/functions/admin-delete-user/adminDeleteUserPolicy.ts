const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1"]);

export const DEFAULT_ALLOWED_ORIGINS = [
  "https://app.solucoes-nexus.tech",
  "https://nexus-ai-ens.vercel.app",
  "http://localhost:8085",
  "http://127.0.0.1:8085",
];

export const canonicalizeOrigin = (raw: string) => {
  const trimmed = raw.trim().replace(/\/+$/, "");
  if (!trimmed) return null;
  if (trimmed === "*") return "*";

  try {
    const url = new URL(trimmed);
    return `${url.protocol}//${url.host}`.toLowerCase();
  } catch {
    return trimmed.toLowerCase();
  }
};

export const parseAllowedOrigins = (allowedOriginsRaw?: string | null) => {
  return [...DEFAULT_ALLOWED_ORIGINS, ...(allowedOriginsRaw ? allowedOriginsRaw.split(",") : [])]
    .map((origin) => canonicalizeOrigin(origin))
    .filter((origin): origin is string => Boolean(origin));
};

const isEquivalentLoopbackOrigin = (left: URL, right: URL) => {
  return (
    left.protocol === right.protocol &&
    LOOPBACK_HOSTS.has(left.hostname.toLowerCase()) &&
    LOOPBACK_HOSTS.has(right.hostname.toLowerCase())
  );
};

export const resolveAllowedOrigin = (origin: string | null, allowedOrigins: string[]) => {
  if (allowedOrigins.includes("*")) return "*";
  if (!origin) return "";

  const canonicalOrigin = canonicalizeOrigin(origin);
  if (!canonicalOrigin) return "";

  let originUrl: URL | null = null;
  try {
    originUrl = new URL(canonicalOrigin);
  } catch {
    originUrl = null;
  }

  const matched = allowedOrigins.some((allowedOrigin) => {
    if (allowedOrigin === canonicalOrigin) return true;
    if (!originUrl) return false;

    try {
      const allowedUrl = new URL(allowedOrigin);
      if (allowedUrl.host === originUrl.host && allowedUrl.protocol === originUrl.protocol) {
        return true;
      }

      return isEquivalentLoopbackOrigin(allowedUrl, originUrl);
    } catch {
      return allowedOrigin === originUrl.host.toLowerCase() || allowedOrigin === originUrl.hostname.toLowerCase();
    }
  });

  return matched ? canonicalOrigin : "";
};

export const getCorsHeaders = (req: Request, allowedOriginsRaw?: string | null) => {
  const origin = req.headers.get("Origin");
  const allowOrigin = resolveAllowedOrigin(origin, parseAllowedOrigins(allowedOriginsRaw));
  const allowAll = allowOrigin === "*";

  return {
    ...(allowAll ? { "Access-Control-Allow-Origin": "*" } : (allowOrigin ? { "Access-Control-Allow-Origin": allowOrigin, Vary: "Origin" } : {})),
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
};

export const isAdminRole = (role: unknown) => role === "admin" || role === "broker";

export const getBearerToken = (authHeader: string) => authHeader.replace(/^Bearer\s+/i, "").trim();

export const isMissingAuthUserError = (message?: string) => {
  const normalized = (message ?? "").toLowerCase();
  return (
    normalized.includes("user not found") ||
    normalized.includes("database error loading user") ||
    normalized.includes("database error finding user")
  );
};
