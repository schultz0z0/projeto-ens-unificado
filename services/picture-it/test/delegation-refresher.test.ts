import { expect, test } from "bun:test";

import { createPictureDelegationRefresher } from "../src/service/delegation-refresher.ts";

const config = {
  url: "http://app-bridge:8080/internal/picture/delegations/refresh",
  internalKey: "picture-refresh-key-at-least-32-characters",
  timeoutMs: 3_000,
};

test("refresh client sends the expired token through the authenticated internal route", async () => {
  const calls: Array<{ input: string | URL | Request; init?: RequestInit }> = [];
  const refresh = createPictureDelegationRefresher(config, {
    fetch: (async (input: string | URL | Request, init?: RequestInit) => {
      calls.push({ input, init });
      return Response.json({ delegation_token: "header.renewed-signature-token" });
    }) as unknown as typeof fetch,
  });

  await expect(refresh("header.expired-signature-token")).resolves.toBe("header.renewed-signature-token");
  expect(String(calls[0]?.input)).toBe(config.url);
  expect(calls[0]?.init?.headers).toEqual({
    "Content-Type": "application/json",
    "X-Internal-Key": config.internalKey,
  });
  expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({ delegation_token: "header.expired-signature-token" });
});

test("refresh client maps a denied parent run to an invalid delegation", async () => {
  const refresh = createPictureDelegationRefresher(config, {
    fetch: (async () => Response.json({ error: "denied" }, { status: 401 })) as unknown as typeof fetch,
  });
  await expect(refresh("header.expired-signature-token")).rejects.toMatchObject({
    code: "picture_delegation_invalid",
    status: 401,
  });
});
