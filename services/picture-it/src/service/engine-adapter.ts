import { readFile } from "node:fs/promises";
import { isAbsolute } from "node:path";
import { executePipeline } from "../pipeline.ts";
import type { PipelineStep } from "../types.ts";
import type { CompositionPlan } from "./contracts.ts";
import { resolveWorkspacePath } from "./workspace-paths.ts";

type ExecutePipeline = (
  steps: PipelineStep[],
  outputPath: string,
  verbose?: boolean,
  options?: { workingDirectory?: string },
) => Promise<string>;

export class PictureEngineAdapter {
  private readonly executePipeline: ExecutePipeline;

  constructor(options: { executePipeline?: ExecutePipeline } = {}) {
    this.executePipeline = options.executePipeline ?? executePipeline;
  }

  async execute(input: {
    packageRoot: string;
    finalPath: string;
    compositionPlan: CompositionPlan;
    verbose?: boolean;
  }) {
    const steps: PipelineStep[] = [];
    for (const step of input.compositionPlan.pipeline) {
      if (step.op === "edit") {
        steps.push({
          ...step,
          assets: step.assets?.map((path) => isAbsolute(path) ? path : resolveWorkspacePath(input.packageRoot, path)),
        } as PipelineStep);
      } else if (step.op === "compose") {
        const overlays = step.overlays_file
          ? JSON.parse(await readFile(resolveWorkspacePath(input.packageRoot, step.overlays_file), "utf8"))
          : step.overlays;
        steps.push({ op: "compose", overlays } as PipelineStep);
      } else {
        steps.push(step as PipelineStep);
      }
    }
    return this.executePipeline(steps, input.finalPath, input.verbose ?? false, {
      workingDirectory: input.packageRoot,
    });
  }
}
