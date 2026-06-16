const HERMES_CAPABILITIES_CACHE_TTL_MS = 60_000;

const cachedCapabilities = new Map<string, {
  expiresAt: number;
  payload: Record<string, unknown>;
}>();

const sanitizeSessionKeySegment = (value: string) => value.replace(/[^a-zA-Z0-9:_-]/g, "-");

export const buildHermesSessionKey = ({
  userId,
  sessionId,
}: {
  userId: string;
  sessionId: string;
}) => {
  const raw = `agent:main:nexus:chat:${sanitizeSessionKeySegment(userId)}:${sanitizeSessionKeySegment(sessionId)}`;
  return raw.slice(0, 256);
};

export const parseHermesCapabilities = (payload: Record<string, unknown>) => {
  const features = payload.features && typeof payload.features === "object"
    ? payload.features as Record<string, unknown>
    : {};
  const endpoints = payload.endpoints && typeof payload.endpoints === "object"
    ? payload.endpoints as Record<string, unknown>
    : {};
  const sessionFeatureFlags = Object.keys(features).filter((key) => key.startsWith("session_"));
  const sessionEndpointKeys = Object.keys(endpoints).filter((key) => key.startsWith("session_"));

  return {
    responsesApi: features.responses_api === true,
    runsApi:
      features.run_submission === true ||
      features.run_events_sse === true ||
      "runs" in endpoints ||
      "run_events" in endpoints,
    sessionsApi: sessionFeatureFlags.length > 0 || sessionEndpointKeys.length > 0,
    sessionKeyHeader: payload.session_key_header === "X-Hermes-Session-Key"
      ? "X-Hermes-Session-Key"
      : "X-Hermes-Session-Key",
  };
};

export const fetchHermesCapabilities = async ({
  hermesBaseUrl,
  hermesApiKey,
}: {
  hermesBaseUrl: URL;
  hermesApiKey: string;
}) => {
  const now = Date.now();
  const cacheKey = hermesBaseUrl.origin;
  const cachedEntry = cachedCapabilities.get(cacheKey);
  if (cachedEntry && cachedEntry.expiresAt > now) {
    return cachedEntry.payload;
  }

  const response = await fetch(new URL("/v1/capabilities", hermesBaseUrl.origin), {
    headers: {
      Authorization: `Bearer ${hermesApiKey}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error("hermes_capabilities_unavailable");
  }

  const payload = await response.json() as Record<string, unknown>;
  cachedCapabilities.set(cacheKey, {
    expiresAt: now + HERMES_CAPABILITIES_CACHE_TTL_MS,
    payload,
  });

  return payload;
};

export const assertHermesCapabilities = async ({
  hermesBaseUrl,
  hermesApiKey,
}: {
  hermesBaseUrl: URL;
  hermesApiKey: string;
}) => {
  const payload = await fetchHermesCapabilities({ hermesBaseUrl, hermesApiKey });
  const capabilities = parseHermesCapabilities(payload);
  if (!capabilities.responsesApi) {
    throw new Error("hermes_responses_api_not_supported");
  }

  return capabilities;
};

export const assertHermesSessionCapabilities = (
  capabilities: ReturnType<typeof parseHermesCapabilities>,
) => {
  if (!capabilities.sessionsApi) {
    throw new Error("hermes_sessions_api_not_supported");
  }

  return capabilities;
};
