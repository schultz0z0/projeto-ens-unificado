import { expect, test } from "bun:test";

const loadClient = async () => {
  try {
    return await import("../src/service/artifact-client.ts");
  } catch (error) {
    expect(error).toBeUndefined();
    throw error;
  }
};

const jsonResponse = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });

test("upload sends complete workspace lifecycle headers", async () => {
  const calls: Array<{ input: string; init?: RequestInit }> = [];
  const { PictureArtifactClient } = await loadClient();
  const client = new PictureArtifactClient({
    baseUrl: "http://artifact-server:8095",
    internalKey: "internal-secret",
    fetchImpl: async (input: URL | RequestInfo, init?: RequestInit) => {
      calls.push({ input: String(input), init });
      return jsonResponse({ id: "artifact-1", lifecycle: "workspace" }, 201);
    },
  });

  const result = await client.uploadWorkspaceArtifact({
    ownerId: "user-1",
    workspaceId: "11111111-1111-4111-8111-111111111111",
    sessionId: "22222222-2222-4222-8222-222222222222",
    relativePath: "planning/steps.json",
    category: "planning",
    contentType: "application/json",
    body: Buffer.from("{}"),
  });

  expect(result.id).toBe("artifact-1");
  expect(calls[0]?.input).toBe("http://artifact-server:8095/v1/artifacts");
  const headers = new Headers(calls[0]?.init?.headers);
  expect(headers.get("authorization")).toBe("Bearer internal-secret");
  expect(headers.get("x-nexus-owner-id")).toBe("user-1");
  expect(headers.get("x-nexus-workspace-id")).toBe("11111111-1111-4111-8111-111111111111");
  expect(headers.get("x-nexus-relative-path")).toBe("planning/steps.json");
  expect(headers.get("x-nexus-artifact-category")).toBe("planning");
  expect(headers.get("x-nexus-artifact-lifecycle")).toBe("workspace");
  expect(headers.get("x-nexus-source")).toBe("picture-hermes");
});

test("list encodes owner and returns manifest artifacts", async () => {
  const { PictureArtifactClient } = await loadClient();
  let requested = "";
  const client = new PictureArtifactClient({
    baseUrl: "http://artifact-server:8095/",
    internalKey: "key",
    fetchImpl: async (input: URL | RequestInfo) => {
      requested = String(input);
      return jsonResponse({ artifacts: [{ id: "a1" }] });
    },
  });
  const result = await client.listWorkspaceArtifacts({
    ownerId: "user with spaces",
    workspaceId: "11111111-1111-4111-8111-111111111111",
  });
  expect(requested).toContain("owner_id=user+with+spaces");
  expect(result).toEqual([{ id: "a1" }]);
});

test("promote and delete workspace use scoped endpoints", async () => {
  const { PictureArtifactClient } = await loadClient();
  const calls: string[] = [];
  const client = new PictureArtifactClient({
    baseUrl: "http://artifact-server:8095",
    internalKey: "key",
    fetchImpl: async (input: URL | RequestInfo, init?: RequestInit) => {
      calls.push(`${init?.method ?? "GET"} ${String(input)}`);
      return jsonResponse(String(input).includes("promote")
        ? { id: "a1", lifecycle: "validated" }
        : { deleted_count: 4 });
    },
  });
  await client.promoteWorkspaceArtifact({
    artifactId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    ownerId: "user-1",
    workspaceId: "11111111-1111-4111-8111-111111111111",
  });
  const deleted = await client.deleteWorkspaceArtifacts({
    ownerId: "user-1",
    workspaceId: "11111111-1111-4111-8111-111111111111",
  });
  expect(deleted.deleted_count).toBe(4);
  expect(calls).toEqual([
    "POST http://artifact-server:8095/v1/artifacts/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/promote",
    "DELETE http://artifact-server:8095/v1/workspaces/11111111-1111-4111-8111-111111111111/artifacts?owner_id=user-1",
  ]);
});

test("download uses internal authentication and returns bytes", async () => {
  const { PictureArtifactClient } = await loadClient();
  const client = new PictureArtifactClient({
    baseUrl: "http://artifact-server:8095",
    internalKey: "key",
    fetchImpl: async (_input: URL | RequestInfo, init?: RequestInit) => {
      expect(new Headers(init?.headers).get("authorization")).toBe("Bearer key");
      return new Response("image-bytes", { status: 200, headers: { "Content-Type": "image/png" } });
    },
  });
  const result = await client.downloadArtifact("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
  expect(Buffer.from(result.bytes).toString("utf8")).toBe("image-bytes");
  expect(result.contentType).toBe("image/png");
});

test("remote errors become safe PictureError values", async () => {
  const { PictureArtifactClient } = await loadClient();
  const client = new PictureArtifactClient({
    baseUrl: "http://artifact-server:8095",
    internalKey: "do-not-leak-this-key",
    fetchImpl: async () => jsonResponse({ error: "forbidden" }, 403),
  });
  let caught: unknown;
  try {
    await client.listWorkspaceArtifacts({
      ownerId: "user-1",
      workspaceId: "11111111-1111-4111-8111-111111111111",
    });
  } catch (error) {
    caught = error;
  }
  expect((caught as Error & { code?: string; status?: number }).code).toBe("picture_artifact_forbidden");
  expect((caught as Error & { status?: number }).status).toBe(403);
  expect(String((caught as Error).message)).not.toContain("do-not-leak-this-key");
});

test("timeout aborts a stalled request", async () => {
  const { PictureArtifactClient } = await loadClient();
  const client = new PictureArtifactClient({
    baseUrl: "http://artifact-server:8095",
    internalKey: "key",
    timeoutMs: 5,
    fetchImpl: async (_input: URL | RequestInfo, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true });
      }),
  });
  await expect(client.listWorkspaceArtifacts({
    ownerId: "user-1",
    workspaceId: "11111111-1111-4111-8111-111111111111",
  })).rejects.toMatchObject({ code: "picture_artifact_timeout" });
});
