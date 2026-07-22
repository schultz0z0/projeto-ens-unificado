import { PictureError } from "../errors.ts";

export interface PictureDelegationRefreshConfig {
  url: string;
  internalKey: string;
  timeoutMs: number;
}

export const createPictureDelegationRefresher = (
  config: PictureDelegationRefreshConfig,
  dependencies: { fetch: typeof globalThis.fetch } = { fetch: globalThis.fetch },
) => async (token: string): Promise<string> => {
  try {
    const response = await dependencies.fetch(config.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Key": config.internalKey,
      },
      body: JSON.stringify({ delegation_token: token }),
      signal: AbortSignal.timeout(config.timeoutMs),
    });
    if ([401, 403, 404, 409].includes(response.status)) {
      throw new PictureError("picture_delegation_invalid", "Picture delegation cannot be renewed.", 401);
    }
    if (!response.ok) {
      throw new PictureError("picture_dependency_unavailable", "Picture delegation refresh is unavailable.", 503);
    }
    const payload = await response.json() as { delegation_token?: unknown };
    if (typeof payload.delegation_token !== "string" || payload.delegation_token.length < 20) {
      throw new PictureError("picture_dependency_unavailable", "Picture delegation refresh returned an invalid response.", 503);
    }
    return payload.delegation_token;
  } catch (error) {
    if (error instanceof PictureError) throw error;
    throw new PictureError("picture_dependency_unavailable", "Picture delegation refresh is unavailable.", 503, { cause: error });
  }
};
