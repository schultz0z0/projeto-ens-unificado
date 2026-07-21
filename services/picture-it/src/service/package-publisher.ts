import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { extname, join, relative, sep } from "node:path";
import { PictureError } from "../errors.ts";
import { normalizeWorkspacePath } from "./workspace-paths.ts";

type PublishedArtifact = Record<string, unknown> & {
  id?: string;
  relative_path?: string | null;
  sha256?: string;
};

interface PublisherArtifactClient {
  listWorkspaceArtifacts(input: { ownerId: string; workspaceId: string; signal?: AbortSignal }): Promise<PublishedArtifact[]>;
  uploadWorkspaceArtifact(input: {
    ownerId: string;
    workspaceId: string;
    sessionId?: string | null;
    relativePath: string;
    category: string;
    contentType: string;
    body: BodyInit;
    signal?: AbortSignal;
  }): Promise<PublishedArtifact>;
}

const categoryByDirectory: Record<string, string> = {
  brief: "brief",
  planning: "planning",
  references: "reference",
  intermediate: "intermediate",
  final: "final",
};

const mimeType = (path: string) => {
  const extension = extname(path).toLowerCase();
  if (extension === ".json") return "application/json";
  if (extension === ".txt" || extension === ".md") return "text/plain; charset=utf-8";
  if (extension === ".png") return "image/png";
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".webp") return "image/webp";
  if (extension === ".svg") return "image/svg+xml";
  return "application/octet-stream";
};

const listFiles = async (root: string, current = root): Promise<string[]> => {
  const entries = await readdir(current, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const path = join(current, entry.name);
    if (entry.isSymbolicLink()) {
      throw new PictureError("picture_package_path_invalid", "Symbolic links are not allowed in a Picture package.", 400);
    }
    if (entry.isDirectory()) files.push(...await listFiles(root, path));
    else if (entry.isFile()) files.push(path);
  }
  return files;
};

export class PicturePackagePublisher {
  constructor(private readonly options: { artifactClient: PublisherArtifactClient }) {}

  async publish(input: {
    root: string;
    jobId: string;
    ownerId: string;
    workspaceId: string;
    sessionId?: string;
    signal?: AbortSignal;
  }): Promise<PublishedArtifact[]> {
    const paths = (await listFiles(input.root)).map((absolutePath) => {
      const relativePath = normalizeWorkspacePath(relative(input.root, absolutePath).split(sep).join("/"));
      const category = categoryByDirectory[relativePath.split("/")[0] || ""];
      if (!category) {
        throw new PictureError("picture_package_path_invalid", "Package file is outside an auditable category.", 400);
      }
      return { absolutePath, relativePath, category };
    }).sort((left, right) => left.relativePath.localeCompare(right.relativePath));

    const existing = await this.options.artifactClient.listWorkspaceArtifacts({
      ownerId: input.ownerId,
      workspaceId: input.workspaceId,
      signal: input.signal,
    });
    const published: PublishedArtifact[] = [];
    for (const file of paths) {
      const bytes = await readFile(file.absolutePath);
      const sha256 = createHash("sha256").update(bytes).digest("hex");
      const reused = existing.find((artifact) => artifact.relative_path === file.relativePath && artifact.sha256 === sha256);
      if (reused) {
        published.push(reused);
        continue;
      }
      const artifact = await this.options.artifactClient.uploadWorkspaceArtifact({
        ownerId: input.ownerId,
        workspaceId: input.workspaceId,
        sessionId: input.sessionId,
        relativePath: file.relativePath,
        category: file.category,
        contentType: mimeType(file.relativePath),
        body: bytes,
        signal: input.signal,
      });
      published.push(artifact);
      existing.push({ ...artifact, relative_path: file.relativePath, sha256: artifact.sha256 || sha256 });
    }
    return published;
  }
}
