import { expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { SignJWT } from "jose";

const KEY = "active-picture-delegation-key-at-least-32-bytes";
const WORKSPACE = "11111111-1111-4111-8111-111111111111";
const USER = "22222222-2222-4222-8222-222222222222";
const keyring = { activeKid: "v2", activeKey: KEY, issuer: "nexus-chat-bridge", audience: "nexus-picture", maxTtlSeconds: 120 };

const token = async (scopes = ["picture:read", "picture:write"]) => {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ tenant_id: "ens", actor_role: "member", chat_session_id: randomUUID(), workspace_id: WORKSPACE, run_id: randomUUID(), scopes, contract_version: 1 })
    .setProtectedHeader({ alg: "HS256", kid: "v2" }).setIssuer("nexus-chat-bridge").setAudience("nexus-picture")
    .setSubject(USER).setJti(randomUUID()).setIssuedAt(now).setNotBefore(now - 1).setExpirationTime(now + 60)
    .sign(new TextEncoder().encode(KEY));
};

const connect = async () => {
  const calls: string[] = [];
  const { createPictureMcpServer } = await import("../src/service/mcp-server.ts");
  const server = createPictureMcpServer({
    keyring,
    workspaceService: { async getOwnedWorkspace() { calls.push("workspace"); return { id: WORKSPACE, status: "drafting" }; } },
    jobService: { async enqueue(input: Record<string, unknown>) { calls.push(String(input.kind)); return { id: "job-1", status: "queued" }; } },
    jobReader: { async getOwnedJob() { calls.push("job"); return { id: "job-1", status: "succeeded" }; } },
  });
  const client = new Client({ name: "picture-test", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return { calls, server, client };
};

test("registers only the four high-level Picture tools", async () => {
  const { server, client } = await connect();
  const listed = await client.listTools();
  expect(listed.tools.map((tool) => tool.name).sort()).toEqual([
    "picture_get_job",
    "picture_get_workspace",
    "picture_revise",
    "picture_start_job",
  ]);
  expect(listed.tools.map((tool) => tool.name)).not.toContain("picture_approve");
  expect(listed.tools.map((tool) => tool.name)).not.toContain("picture_reset");
  const start = listed.tools.find((tool) => tool.name === "picture_start_job");
  const rawPlan = (start?.inputSchema as any)?.properties?.composition_plan;
  const plan = rawPlan?.properties || rawPlan?.anyOf?.[0]?.properties || rawPlan?.oneOf?.[0]?.properties;
  const pipeline = plan?.pipeline;
  expect(pipeline?.description || JSON.stringify(rawPlan)).toContain("native JSON array");
  await client.close(); await server.close();
});

test("binds every tool call to delegated user and workspace", async () => {
  const { calls, server, client } = await connect();
  const delegation = await token();
  const workspace = await client.callTool({ name: "picture_get_workspace", arguments: { delegation_token: delegation, workspace_id: WORKSPACE } });
  expect(workspace.isError).not.toBe(true);
  const denied = await client.callTool({ name: "picture_get_workspace", arguments: { delegation_token: await token(["picture:write"]), workspace_id: WORKSPACE } });
  expect(denied.isError).toBe(true);
  expect(calls).toContain("workspace");
  await client.close(); await server.close();
});
