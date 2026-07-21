import { expect, test } from "bun:test";
import path from "node:path";

const loadPaths = async () => {
  try {
    return await import("../src/service/workspace-paths.ts");
  } catch (error) {
    expect(error).toBeUndefined();
    throw error;
  }
};

test("normalizeWorkspacePath accepts a POSIX relative path", async () => {
  const { normalizeWorkspacePath } = await loadPaths();
  expect(normalizeWorkspacePath("planning/steps.json")).toBe("planning/steps.json");
});

test("normalizeWorkspacePath rejects traversal, absolute and Windows paths", async () => {
  const { normalizeWorkspacePath } = await loadPaths();
  for (const candidate of [
    "../secret.json",
    "planning/../../secret.json",
    "/etc/passwd",
    "C:/Windows/win.ini",
    "planning\\steps.json",
    "planning/\0steps.json",
    "",
  ]) {
    expect(() => normalizeWorkspacePath(candidate)).toThrow();
  }
});

test("resolveWorkspacePath stays under the workspace root", async () => {
  const { resolveWorkspacePath } = await loadPaths();
  const root = path.resolve("C:/workspace/job");
  const resolved = resolveWorkspacePath(root, "final/piece.png");
  expect(resolved).toBe(path.join(root, "final", "piece.png"));
});

test("isWorkspacePath identifies allowed final files", async () => {
  const { isWorkspacePath } = await loadPaths();
  expect(isWorkspacePath("final/piece.png", { prefix: "final/" })).toBe(true);
  expect(isWorkspacePath("planning/steps.json", { prefix: "final/" })).toBe(false);
});
