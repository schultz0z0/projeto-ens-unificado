export type HermesSessionSummary = {
  id: string;
  title?: string | null;
};

type HermesFetch = typeof fetch;

export const isHermesSessionApiUnavailableError = (error: unknown) => {
  if (!(error instanceof Error)) return false;
  return /hermes_session_create_failed:(404|405|501)/.test(error.message);
};

const buildHermesSessionHeaders = (hermesApiKey: string) => ({
  Authorization: `Bearer ${hermesApiKey}`,
  Accept: "application/json",
  "Content-Type": "application/json",
});

const parseSessionResponse = async (response: Response) => {
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  const id = typeof payload.id === "string"
    ? payload.id
    : payload.session && typeof payload.session === "object" && typeof payload.session.id === "string"
      ? payload.session.id
      : null;

  if (!id) {
    throw new Error("hermes_session_invalid_response");
  }

  return {
    id,
    title: typeof payload.title === "string"
      ? payload.title
      : payload.session && typeof payload.session === "object" && typeof payload.session.title === "string"
        ? payload.session.title
        : null,
  } satisfies HermesSessionSummary;
};

export const createHermesSession = async ({
  hermesBaseUrl,
  hermesApiKey,
  title,
  fetchImpl = fetch,
}: {
  hermesBaseUrl: URL;
  hermesApiKey: string;
  title?: string;
  fetchImpl?: HermesFetch;
}) => {
  const response = await fetchImpl(new URL("/api/sessions", hermesBaseUrl.origin), {
    method: "POST",
    headers: buildHermesSessionHeaders(hermesApiKey),
    body: JSON.stringify(title?.trim() ? { title: title.trim() } : {}),
  });

  if (!response.ok) {
    throw new Error(`hermes_session_create_failed:${response.status}`);
  }

  return await parseSessionResponse(response);
};

export const deleteHermesSession = async ({
  hermesBaseUrl,
  hermesApiKey,
  hermesSessionId,
  fetchImpl = fetch,
}: {
  hermesBaseUrl: URL;
  hermesApiKey: string;
  hermesSessionId: string;
  fetchImpl?: HermesFetch;
}) => {
  const response = await fetchImpl(new URL(`/api/sessions/${encodeURIComponent(hermesSessionId)}`, hermesBaseUrl.origin), {
    method: "DELETE",
    headers: buildHermesSessionHeaders(hermesApiKey),
  });

  if (response.status === 404) {
    return false;
  }

  if (!response.ok) {
    throw new Error(`hermes_session_delete_failed:${response.status}`);
  }

  return true;
};
