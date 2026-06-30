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
