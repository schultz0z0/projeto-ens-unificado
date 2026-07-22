import { expect, test } from "bun:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createPictureMcpHttpHandler } from "../src/service/http-server.ts";

const withTimeout = async <T>(promise: Promise<T>, message: string): Promise<T> => Promise.race([
  promise,
  new Promise<never>((_, reject) => setTimeout(() => reject(new Error(message)), 2_000)),
]);

test("completes the real Streamable HTTP initialize and tools/list handshake", async () => {
  const handleMcp = createPictureMcpHttpHandler({
    keyring: {
      activeKid: "active",
      activeKey: "picture-http-test-key-at-least-32-bytes",
      issuer: "picture-http-test",
      audience: "picture-http-test",
    },
    workspaceService: { async getOwnedWorkspace() { return {}; } },
    jobService: { async enqueue() { return {}; } },
    jobReader: { async getOwnedJob() { return {}; } },
  });
  const http = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: handleMcp });
  const client = new Client({ name: "picture-http-test", version: "1.0.0" });
  const transport = new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${http.port}/mcp`));

  try {
    await withTimeout(client.connect(transport), "MCP initialize timed out");
    const listed = await withTimeout(client.listTools(), "MCP tools/list timed out");
    expect(listed.tools.map((tool) => tool.name).sort()).toEqual([
      "picture_get_job",
      "picture_get_workspace",
      "picture_revise",
      "picture_start_job",
    ]);
  } finally {
    await client.close().catch(() => undefined);
    http.stop(true);
  }
}, 5_000);
