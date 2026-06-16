const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1"]);

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
  return (allowedOriginsRaw ? allowedOriginsRaw.split(",") : [])
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
