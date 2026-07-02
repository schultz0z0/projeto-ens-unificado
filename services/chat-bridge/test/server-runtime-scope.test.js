import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../src/server.js", import.meta.url), "utf8");

const extractBlock = (text, marker, nextMarker) => {
  const start = text.indexOf(marker);
  assert.notEqual(start, -1, `${marker} not found`);
  const end = nextMarker ? text.indexOf(nextMarker, start + marker.length) : text.length;
  assert.notEqual(end, -1, `${nextMarker} not found after ${marker}`);
  return text.slice(start, end);
};

test("executeRun does not use chat-delete scoped session variables", () => {
  const executeRunBlock = extractBlock(source, "async executeRun(runId)", "const store = new RunStore");

  assert.equal(executeRunBlock.includes("buildHermesRunSessionId(sessionId)"), false);
  assert.equal(executeRunBlock.includes("state?.hermes_session_id"), false);
  assert.equal(executeRunBlock.includes("user.id"), false);
});

test("chat delete route collects Hermes session ids before storage cleanup", () => {
  const deleteRouteBlock = extractBlock(
    source,
    'url.pathname === "/api/chat/session/delete"',
    'url.pathname === "/api/chat/runs"',
  );

  assert.match(deleteRouteBlock, /const hermesSessionIds = new Set/);
  assert.match(deleteRouteBlock, /buildHermesRunSessionId\(sessionId\)/);
  assert.match(deleteRouteBlock, /deleteChatSessionData\(\{/);
  assert.match(deleteRouteBlock, /hermesSessionIds: Array\.from\(hermesSessionIds\)/);
});

test("approval stream bridges the Hermes approval websocket instead of dashboard event SSE", () => {
  const approvalRouteBlock = extractBlock(
    source,
    'url.pathname === "/api/approvals/stream"',
    'jsonResponse(res, 404',
  );

  assert.match(approvalRouteBlock, /\/api\/approvals\/ws/);
  assert.doesNotMatch(approvalRouteBlock, /\/api\/events\?channel=approvals/);
  assert.doesNotMatch(approvalRouteBlock, /Accept: "text\/event-stream"/);
});

test("Hermes headers forward tenant and user context for memory MCP routing", () => {
  const headersBlock = extractBlock(
    source,
    "buildHermesHeaders(accept, run)",
    "async fetchHermesEvents",
  );

  assert.match(headersBlock, /"X-Tenant-Id": run\.tenant_id/);
  assert.match(headersBlock, /"X-User-Id": run\.user_id/);
  assert.match(headersBlock, /"X-Nexus-User-Id": run\.user_id/);
  assert.match(headersBlock, /"X-Nexus-User-Role": run\.user_role/);
});

test("created chat runs preserve trusted tenant context for downstream memory tools", () => {
  const createRunBlock = extractBlock(
    source,
    "async createRun({ user, payload })",
    "async ensureHermesSessionBinding",
  );

  assert.match(createRunBlock, /tenant_id: user\.tenant_id/);
  assert.match(createRunBlock, /user_id: user\.id/);
  assert.match(createRunBlock, /user_role: user\.role/);
  assert.match(createRunBlock, /user_name: user\.name/);
});

test("Hermes request builders receive Nexus role context", () => {
  assert.match(source, /const buildRunNexusContext = \(run\) =>/);
  assert.match(source, /nexusContext: buildRunNexusContext\(run\)/);
  assert.match(source, /userRole: run\.user_role/);
});

test("bridge exposes authenticated memory diagnostics with graph health", () => {
  const diagnosticsRouteBlock = extractBlock(
    source,
    'url.pathname === "/api/memory/diagnostics"',
    'const artifactAccessMatch',
  );

  assert.match(diagnosticsRouteBlock, /const user = await verifyUser\(req\)/);
  assert.match(diagnosticsRouteBlock, /const graphHealth = await fetchGraphHealth\(\)/);
  assert.match(diagnosticsRouteBlock, /memory_diagnostics: run\.memory_diagnostics/);
});

test("run events update memory diagnostics from Hermes tool metadata", () => {
  const appendEventBlock = extractBlock(
    source,
    "appendEvent(run, event)",
    "async importFilesEventArtifacts",
  );

  assert.match(appendEventBlock, /applyMemoryDiagnosticEvent\(run\.memory_diagnostics, normalizedEvent\)/);
});
