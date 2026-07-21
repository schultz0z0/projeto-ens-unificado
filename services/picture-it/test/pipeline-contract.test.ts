import { expect, test } from "bun:test";

import type { PipelineStep } from "../src/types.ts";

test("PipelineStep represents every operation supported by the engine", () => {
  const steps: PipelineStep[] = [
    { op: "generate", prompt: "background", size: "1080x1080" },
    { op: "edit", prompt: "adjust lighting", assets: ["reference.png"] },
    { op: "remove-bg" },
    { op: "replace-bg", prompt: "orange studio" },
    { op: "crop", size: "1080x1080" },
    { op: "grade", name: "warm-editorial" },
    { op: "grain", intensity: 0.05 },
    { op: "vignette", opacity: 0.2 },
    { op: "text", title: "Matrículas abertas" },
    { op: "compose", overlays: [] },
    { op: "upscale", scale: 2 },
  ];

  expect(steps.map((step) => step.op)).toEqual([
    "generate",
    "edit",
    "remove-bg",
    "replace-bg",
    "crop",
    "grade",
    "grain",
    "vignette",
    "text",
    "compose",
    "upscale",
  ]);
});
