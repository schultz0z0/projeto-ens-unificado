import { afterEach, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const roots: string[] = [];
afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))));

const loadPublisher = async () => {
  try {
    return await import("../src/service/package-publisher.ts");
  } catch (error) {
    expect(error).toBeUndefined();
    throw error;
  }
};

test("publishes every category and skips byte-identical reruns", async () => {
  const { PicturePackagePublisher } = await loadPublisher();
  const root = await mkdtemp(join(tmpdir(), "picture-publish-test-"));
  roots.push(root);
  const files = {
    "brief/brief.json": "{}",
    "planning/steps.json": "[]",
    "references/logo.png": "logo",
    "intermediate/base.png": "base",
    "final/peca.png": "final",
  };
  for (const [relativePath, body] of Object.entries(files)) {
    await mkdir(join(root, relativePath, ".."), { recursive: true });
    await writeFile(join(root, relativePath), body);
  }

  const stored: Array<Record<string, unknown>> = [];
  const calls: Array<Record<string, unknown>> = [];
  const artifactClient = {
    async listWorkspaceArtifacts() { return stored; },
    async uploadWorkspaceArtifact(input: Record<string, unknown>) {
      calls.push(input);
      const body = Buffer.from(input.body as Uint8Array);
      const relativePath = String(input.relativePath);
      const entry = {
        id: `artifact-${stored.length + 1}`,
        relative_path: relativePath,
        category: String(input.category),
        sha256: createHash("sha256").update(body).digest("hex"),
      };
      stored.push(entry);
      return entry;
    },
  };
  const publisher = new PicturePackagePublisher({ artifactClient });
  const input = { root, jobId: "job-1", ownerId: "user-1", workspaceId: "11111111-1111-4111-8111-111111111111", sessionId: "22222222-2222-4222-8222-222222222222" };
  const first = await publisher.publish(input);
  const second = await publisher.publish(input);

  expect(first).toHaveLength(5);
  expect(second).toHaveLength(5);
  expect(calls).toHaveLength(5);
  expect(calls.map((call) => [call.relativePath, call.category])).toEqual([
    ["brief/brief.json", "brief"],
    ["final/peca.png", "final"],
    ["intermediate/base.png", "intermediate"],
    ["planning/steps.json", "planning"],
    ["references/logo.png", "reference"],
  ]);
});

test("rejects files outside the auditable workspace categories", async () => {
  const { PicturePackagePublisher } = await loadPublisher();
  const root = await mkdtemp(join(tmpdir(), "picture-publish-test-"));
  roots.push(root);
  await writeFile(join(root, "secret.txt"), "nope");
  const publisher = new PicturePackagePublisher({ artifactClient: { async listWorkspaceArtifacts() { return []; }, async uploadWorkspaceArtifact() { return {}; } } });
  await expect(publisher.publish({ root, jobId: "job-2", ownerId: "user-1", workspaceId: "11111111-1111-4111-8111-111111111111" })).rejects.toMatchObject({ code: "picture_package_path_invalid" });
});
