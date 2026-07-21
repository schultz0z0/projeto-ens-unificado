import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, extname, join } from "node:path";
import { PictureError } from "../errors.ts";
import {
  CompositionPlanSchema,
  CreativeBriefSchema,
  type CompositionPlan,
  type CreativeBrief,
  type ManifestEntry,
} from "./contracts.ts";
import { resolveWorkspacePath } from "./workspace-paths.ts";

interface ReferenceArtifactClient {
  downloadArtifact(artifactId: string, signal?: AbortSignal): Promise<{ bytes: Uint8Array; contentType: string }>;
}

const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;

const safeReferenceName = (relativePath: string, artifactId: string) => {
  const original = basename(relativePath.replace(/\\/g, "/"));
  const extension = extname(original).toLowerCase().replace(/[^.a-z0-9]/g, "");
  const stem = basename(original, extname(original))
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
  return `${stem || `reference-${artifactId.slice(0, 8)}`}${extension || ".bin"}`;
};

export interface BuiltPicturePackage {
  root: string;
  finalPath: string;
  cleanup(): Promise<void>;
}

export class PicturePackageBuilder {
  constructor(private readonly options: { artifactClient: ReferenceArtifactClient; tempRoot?: string }) {}

  async build(input: {
    workspaceId: string;
    jobId: string;
    creativeBrief: CreativeBrief;
    compositionPlan: CompositionPlan;
    referenceArtifactIds: string[];
    manifest: ManifestEntry[];
    signal?: AbortSignal;
  }): Promise<BuiltPicturePackage> {
    const brief = CreativeBriefSchema.parse(input.creativeBrief);
    const plan = CompositionPlanSchema.parse(input.compositionPlan);
    const root = await mkdtemp(join(this.options.tempRoot || tmpdir(), `picture-${input.workspaceId.slice(0, 8)}-${input.jobId.slice(0, 12)}-`));
    try {
      for (const directory of ["brief", "planning", "references", "intermediate", "final"]) {
        await mkdir(resolveWorkspacePath(root, directory), { recursive: true });
      }

      const overlays = plan.pipeline.flatMap((step) => step.op === "compose" && step.overlays ? step.overlays : []);
      await Promise.all([
        writeFile(resolveWorkspacePath(root, "brief/brief.json"), json(brief), "utf8"),
        writeFile(resolveWorkspacePath(root, "planning/prompt.txt"), `${plan.base_prompt.trim()}\n`, "utf8"),
        writeFile(resolveWorkspacePath(root, "planning/composition-plan.json"), json(plan), "utf8"),
        writeFile(resolveWorkspacePath(root, "planning/steps.json"), json(plan.pipeline), "utf8"),
        writeFile(resolveWorkspacePath(root, "planning/overlays.json"), json(overlays), "utf8"),
      ]);

      const usedNames = new Set<string>();
      for (const artifactId of input.referenceArtifactIds) {
        const entry = input.manifest.find((candidate) =>
          candidate.artifact_id === artifactId
          && candidate.workspace_id === input.workspaceId
          && candidate.category === "reference"
          && candidate.lifecycle === "workspace"
        );
        if (!entry) {
          throw new PictureError("picture_reference_not_owned", "A requested reference is not available in this workspace.", 403);
        }
        let filename = safeReferenceName(entry.relative_path, artifactId);
        if (usedNames.has(filename)) {
          const extension = extname(filename);
          filename = `${basename(filename, extension)}-${artifactId.slice(0, 8)}${extension}`;
        }
        usedNames.add(filename);
        const downloaded = await this.options.artifactClient.downloadArtifact(artifactId, input.signal);
        await writeFile(resolveWorkspacePath(root, `references/${filename}`), downloaded.bytes);
      }

      return {
        root,
        finalPath: resolveWorkspacePath(root, plan.final_path),
        cleanup: () => rm(root, { recursive: true, force: true }),
      };
    } catch (error) {
      await rm(root, { recursive: true, force: true });
      throw error;
    }
  }
}
