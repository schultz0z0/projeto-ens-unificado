import { expect, test } from "bun:test";

const KEY = "picture-internal-key-at-least-32-bytes";
const USER = "11111111-1111-4111-8111-111111111111";
const SESSION = "22222222-2222-4222-8222-222222222222";
const WORKSPACE = "33333333-3333-4333-8333-333333333333";

const deps = () => {
  const calls: string[] = [];
  return {
    calls,
    options: {
      internalKey: KEY,
      workspaceService: {
        async ensureActive() { calls.push("ensure"); return { id: WORKSPACE, status: "drafting" }; },
        async getOwnedWorkspace() { calls.push("get"); return { id: WORKSPACE, status: "review" }; },
        async approveCandidate() { calls.push("approve"); return { id: WORKSPACE, status: "validated" }; },
        async beginReset() { calls.push("begin-reset"); return { id: WORKSPACE, status: "resetting" }; },
        async closeAfterArtifactCleanup() { calls.push("close-reset"); return { id: WORKSPACE, status: "closed" }; },
      },
      artifactClient: {
        async listWorkspaceArtifacts() { calls.push("manifest"); return [{ id: "artifact-1" }]; },
      },
      referenceService: { async importReferences() { calls.push("references"); return [{ id: "reference-1" }]; } },
      readiness: async () => true,
      handleMcp: async () => new Response(JSON.stringify({ jsonrpc: "2.0", result: {} }), { headers: { "content-type": "application/json" } }),
      allowedOrigins: ["https://app.example.com"],
    },
  };
};

const internalRequest = (path: string, init: RequestInit = {}) => new Request(`http://picture.local${path}`, {
  ...init,
  headers: {
    authorization: `Bearer ${KEY}`,
    "content-type": "application/json",
    "x-nexus-user-id": USER,
    "x-nexus-tenant-id": "ens",
    "x-nexus-session-id": SESSION,
    ...init.headers,
  },
});

test("health is public, ready is truthful and internal routes reject missing auth", async () => {
  const { createPictureHttpHandler } = await import("../src/service/http-server.ts");
  const setup = deps();
  const handler = createPictureHttpHandler(setup.options);
  expect((await handler(new Request("http://picture.local/health"))).status).toBe(200);
  expect((await handler(new Request("http://picture.local/ready"))).status).toBe(200);
  expect((await handler(new Request(`http://picture.local/internal/workspaces/${WORKSPACE}`))).status).toBe(401);
});

test("ensures, reads and lists an explicitly scoped workspace", async () => {
  const { createPictureHttpHandler } = await import("../src/service/http-server.ts");
  const setup = deps();
  const handler = createPictureHttpHandler(setup.options);
  const ensured = await handler(internalRequest("/internal/workspaces/ensure", { method: "POST", body: JSON.stringify({ chat_session_id: SESSION }) }));
  const loaded = await handler(internalRequest(`/internal/workspaces/${WORKSPACE}`));
  const manifest = await handler(internalRequest(`/internal/workspaces/${WORKSPACE}/manifest`));
  expect([ensured.status, loaded.status, manifest.status]).toEqual([200, 200, 200]);
  expect(setup.calls).toEqual(["ensure", "get", "manifest"]);
});

test("imports references, approves and resets only through internal REST", async () => {
  const { createPictureHttpHandler } = await import("../src/service/http-server.ts");
  const setup = deps();
  const handler = createPictureHttpHandler(setup.options);
  await handler(internalRequest(`/internal/workspaces/${WORKSPACE}/references`, { method: "POST", body: JSON.stringify({ artifact_ids: ["44444444-4444-4444-8444-444444444444"] }) }));
  await handler(internalRequest(`/internal/workspaces/${WORKSPACE}/approve`, { method: "POST", body: "{}" }));
  await handler(internalRequest(`/internal/workspaces/${WORKSPACE}/reset`, { method: "POST", body: "{}" }));
  expect(setup.calls).toEqual(["references", "approve", "begin-reset", "close-reset"]);
});

test("handles MCP only on POST and restricts browser origins", async () => {
  const { createPictureHttpHandler } = await import("../src/service/http-server.ts");
  const setup = deps();
  const handler = createPictureHttpHandler(setup.options);
  expect((await handler(new Request("http://picture.local/mcp"))).status).toBe(405);
  expect((await handler(new Request("http://picture.local/mcp", { method: "POST", body: "{}", headers: { origin: "https://evil.example" } }))).status).toBe(403);
  expect((await handler(new Request("http://picture.local/mcp", { method: "POST", body: "{}", headers: { origin: "https://app.example.com" } }))).status).toBe(200);
});
