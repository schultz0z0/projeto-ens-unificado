const disallowedHost = (hostLower: string) => {
  if (hostLower === "localhost" || hostLower.endsWith(".localhost")) return true;
  if (hostLower === "0.0.0.0") return true;
  if (hostLower === "127.0.0.1") return true;
  if (hostLower.endsWith(".local")) return true;
  if (hostLower.startsWith("10.")) return true;
  if (hostLower.startsWith("192.168.")) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(hostLower)) return true;
  return false;
};

const tryReadHostname = (raw?: string | null) => {
  if (!raw?.trim()) return null;
  try {
    return new URL(raw).hostname.toLowerCase();
  } catch {
    return null;
  }
};

export const parseAllowedHosts = (allowedHostsRaw?: string | null, defaultBaseUrlRaw?: string | null) => {
  const allowedHosts = new Set(
    (allowedHostsRaw ?? "")
      .split(",")
      .map((host) => host.trim().toLowerCase())
      .filter(Boolean),
  );

  const defaultHost = tryReadHostname(defaultBaseUrlRaw);
  if (defaultHost) {
    allowedHosts.add(defaultHost);
  }

  return Array.from(allowedHosts);
};

export const validateHermesBaseUrl = (
  raw: string,
  allowedHostsRaw?: string | null,
  defaultBaseUrlRaw?: string | null,
): URL => {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error("missing_env:HERMES_DEFAULT_BASE_URL");

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error("invalid_env:HERMES_BASE_URL");
  }

  if (url.protocol !== "https:") throw new Error("invalid_env:HERMES_BASE_URL_PROTOCOL");
  if (url.username || url.password) throw new Error("invalid_env:HERMES_BASE_URL_USERINFO");
  if (url.search || url.hash) throw new Error("invalid_env:HERMES_BASE_URL_QUERY");

  url.pathname = "/";

  const hostLower = url.hostname.toLowerCase();
  if (disallowedHost(hostLower)) throw new Error("invalid_env:HERMES_BASE_URL_HOST");

  const allowedHosts = parseAllowedHosts(allowedHostsRaw, defaultBaseUrlRaw);
  if (!allowedHosts.includes(hostLower)) {
    throw new Error("invalid_env:HERMES_BASE_URL_NOT_ALLOWED");
  }

  return url;
};
