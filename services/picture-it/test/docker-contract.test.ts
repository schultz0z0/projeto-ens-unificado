import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const root = join(import.meta.dir, "..");

test("Docker image is pinned, multi-stage, non-root and operational", async () => {
  const dockerfile = await readFile(join(root, "Dockerfile"), "utf8");
  expect(dockerfile).toMatch(/^FROM oven\/bun:1\.3\.14/m);
  expect((dockerfile.match(/^FROM /gm) || []).length).toBeGreaterThanOrEqual(2);
  expect(dockerfile).toContain("bun install --frozen-lockfile");
  expect(dockerfile).toContain("bun run download-fonts");
  expect(dockerfile).toMatch(/USER\s+\S+/);
  expect(dockerfile).toContain("HEALTHCHECK");
  expect(dockerfile).toContain("/tmp/picture-work");
  expect(dockerfile).toContain("EXPOSE 8090");
  expect(dockerfile).toContain("docker-entrypoint.sh");
});

test("container context excludes secrets, generated data and fixtures", async () => {
  const ignored = await readFile(join(root, ".dockerignore"), "utf8");
  for (const entry of [".env", "node_modules", "dist", "fixtures", "*.png"]) {
    expect(ignored).toContain(entry);
  }
  const entrypoint = await readFile(join(root, "docker-entrypoint.sh"), "utf8");
  expect(entrypoint).toContain("exec");
  expect(entrypoint).toContain("tini");
});
