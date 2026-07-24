import { z } from "zod";

import { isWorkspacePath } from "./workspace-paths.ts";

const uuid = z.string().uuid();
const shortText = z.string().trim().min(1).max(500);
const workspacePath = z.string().refine((value) => isWorkspacePath(value), "Unsafe workspace path");
const finalPath = z.string().refine(
  (value) => isWorkspacePath(value, { prefix: "final/" }),
  "Final path must be a safe path under final/",
);
const size = z.string().regex(/^\d{2,5}x\d{2,5}$/);

const falModel = z.enum([
  "flux-schnell",
  "flux-dev",
  "recraft-v3",
  "recraft-v4",
  "imagineart",
  "fibo",
  "kontext",
  "kontext-lora",
  "reve",
  "reve-fast",
  "fibo-edit",
  "seedream",
  "seedream-v4",
  "banana2",
  "banana-pro",
]);

const colorGrade = z.enum(["cinematic", "moody", "vibrant", "clean", "warm-editorial", "cool-tech"]);
const depth = z.enum(["background", "midground", "foreground", "overlay", "frame"]);
const zone = z.union([
  z.enum([
    "hero-center",
    "title-area",
    "top-bar",
    "bottom-bar",
    "left-third",
    "right-third",
    "top-left-safe",
    "top-right-safe",
    "bottom-left-safe",
    "bottom-right-safe",
    "center-left",
    "center-right",
  ]),
  z.object({ x: z.number().finite(), y: z.number().finite() }).strict(),
]);

/**
 * Normalizes a value that should be an array but may arrive as a single item
 * or as an XML-parser wrapper object like `{ item: [...] }` or `{ item: {...} }`.
 */
const coerceArray = <T extends z.ZodTypeAny>(schema: T, maxItems?: number) => {
  const inner = maxItems != null ? z.array(schema).max(maxItems) : z.array(schema);
  return z.preprocess((value) => {
    if (Array.isArray(value)) return value;
    if (value != null && typeof value === "object" && !Array.isArray(value)) {
      const keys = Object.keys(value as Record<string, unknown>);
      if (keys.length === 1 && keys[0] === "item") {
        const inner = (value as Record<string, unknown>).item;
        return Array.isArray(inner) ? inner : [inner];
      }
    }
    if (value === undefined || value === null) return undefined;
    return [value];
  }, inner);
};

const satoriNode: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.string(),
    z.number().transform(String),
    z.object({
      tag: z.string().min(1).max(80),
      props: z.record(z.string(), z.unknown()).optional(),
      children: coerceArray(satoriNode).optional(),
    }).strict(),
  ])
);

const imageOverlay = z.object({
  type: z.literal("image"),
  src: workspacePath,
  zone: zone.optional(),
  width: z.union([z.number().positive(), z.string().min(1)]).optional(),
  height: z.union([z.number().positive(), z.string().min(1)]).optional(),
  anchor: z.enum(["center", "top-left", "top-right", "bottom-left", "bottom-right"]).optional(),
  opacity: z.number().min(0).max(1).optional(),
  borderRadius: z.number().nonnegative().optional(),
  rotation: z.number().finite().optional(),
  depth: depth.optional(),
}).strict();

const textOverlay = z.object({
  type: z.literal("satori-text"),
  jsx: satoriNode,
  zone: zone.optional(),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
  anchor: z.enum(["center", "top-left", "top-right", "bottom-left", "bottom-right"]).optional(),
  opacity: z.number().min(0).max(1).optional(),
  depth: depth.optional(),
}).strict();

const shapeOverlay = z.object({
  type: z.literal("shape"),
  shape: z.enum(["rect", "circle", "line", "arrow"]),
  zone: zone.optional(),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
  fill: z.string().optional(),
  stroke: z.string().optional(),
  strokeWidth: z.number().nonnegative().optional(),
  borderRadius: z.number().nonnegative().optional(),
  opacity: z.number().min(0).max(1).optional(),
  from: z.object({ x: z.number(), y: z.number() }).strict().optional(),
  to: z.object({ x: z.number(), y: z.number() }).strict().optional(),
  headSize: z.number().positive().optional(),
  curve: z.number().finite().optional(),
  depth: depth.optional(),
}).strict();

const gradientOverlay = z.object({
  type: z.literal("gradient-overlay"),
  gradient: z.string().min(1).max(2_000),
  opacity: z.number().min(0).max(1).optional(),
  blend: z.enum(["normal", "multiply", "screen", "overlay"]).optional(),
  depth: depth.optional(),
}).strict();

const watermarkOverlay = z.object({
  type: z.literal("watermark"),
  src: workspacePath,
  position: z.enum(["bottom-right", "bottom-left", "top-right", "top-left"]).optional(),
  margin: z.number().nonnegative().optional(),
  opacity: z.number().min(0).max(1).optional(),
  size: z.number().positive().optional(),
  depth: depth.optional(),
}).strict();

export const OverlaySchema = z.discriminatedUnion("type", [
  imageOverlay,
  textOverlay,
  shapeOverlay,
  gradientOverlay,
  watermarkOverlay,
]);

const pipelineStep = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("generate"),
    prompt: z.string().trim().min(1).max(20_000),
    model: falModel.optional(),
    size: size.optional(),
    platform: z.string().trim().min(1).max(80).optional(),
  }).strict(),
  z.object({
    op: z.literal("edit"),
    prompt: z.string().trim().min(1).max(20_000),
    model: falModel.optional(),
    assets: z.array(workspacePath).max(20).optional(),
    size: size.optional(),
  }).strict(),
  z.object({ op: z.literal("remove-bg") }).strict(),
  z.object({
    op: z.literal("replace-bg"),
    prompt: z.string().trim().min(1).max(20_000),
    model: falModel.optional(),
  }).strict(),
  z.object({
    op: z.literal("crop"),
    size,
    position: z.string().trim().min(1).max(80).optional(),
  }).strict(),
  z.object({ op: z.literal("grade"), name: colorGrade }).strict(),
  z.object({ op: z.literal("grain"), intensity: z.number().min(0).max(1).optional() }).strict(),
  z.object({ op: z.literal("vignette"), opacity: z.number().min(0).max(1).optional() }).strict(),
  z.object({
    op: z.literal("text"),
    title: z.string().min(1).max(2_000),
    font: z.string().min(1).max(100).optional(),
    color: z.string().min(1).max(100).optional(),
    fontSize: z.number().positive().max(1_000).optional(),
    zone: z.string().min(1).max(100).optional(),
  }).strict(),
  z.object({
    op: z.literal("compose"),
    overlays_file: workspacePath.optional(),
    overlays: coerceArray(OverlaySchema, 200).optional().describe(
      "Use a native JSON array of overlay objects. XML wrappers like {item: [...]} are auto-normalized.",
    ),
  }).strict().refine((value) => Boolean(value.overlays_file || value.overlays), {
    message: "Compose requires overlays_file or overlays",
  }),
  z.object({ op: z.literal("upscale"), scale: z.number().int().min(2).max(4).optional() }).strict(),
]);

export const CreativeBriefSchema = z.object({
  title: shortText,
  campaign_type: shortText,
  channel: shortText,
  objective: z.string().trim().min(1).max(2_000),
  audience: z.string().trim().min(1).max(2_000),
  offer: z.string().trim().min(1).max(2_000),
  copy_points: z.array(z.string().trim().min(1).max(1_000)).min(1).max(30),
  cta: z.string().trim().min(1).max(500),
  visual_style: z.string().trim().min(1).max(2_000),
  brand_profile: shortText,
  output: z.object({
    width: z.number().int().min(64).max(8_192),
    height: z.number().int().min(64).max(8_192),
    format: z.enum(["png", "jpg", "webp"]),
  }).strict(),
}).strict();

export const CompositionPlanSchema = z.object({
  version: z.literal(1),
  base_prompt: z.string().trim().min(1).max(20_000),
  pipeline: z.array(pipelineStep).min(1).max(50).describe(
    "Use a native JSON array of ordered image operations. Each compose.overlays value is also a native JSON array.",
  ),
  final_path: finalPath,
}).strict();

export const PictureJobRequestSchema = z.object({
  workspace_id: uuid,
  creative_brief: CreativeBriefSchema,
  composition_plan: CompositionPlanSchema,
  reference_artifact_ids: z.array(uuid).max(20).default([]),
  idempotency_key: z.string().trim().min(1).max(180),
}).strict();

export const PictureRevisionRequestSchema = z.object({
  workspace_id: uuid,
  revision_request: z.string().trim().min(1).max(5_000),
  composition_plan: CompositionPlanSchema,
  idempotency_key: z.string().trim().min(1).max(180),
}).strict();

export const ManifestEntrySchema = z.object({
  artifact_id: uuid,
  workspace_id: uuid,
  relative_path: workspacePath,
  category: z.enum(["brief", "reference", "planning", "intermediate", "final"]),
  content_type: z.string().trim().min(1).max(255),
  size: z.number().int().nonnegative(),
  lifecycle: z.enum(["workspace", "validated"]),
  preview_url: z.string().url().optional(),
  preview_url_expires_at: z.string().datetime().optional(),
  created_at: z.string().datetime(),
}).strict();

export type CreativeBrief = z.infer<typeof CreativeBriefSchema>;
export type CompositionPlan = z.infer<typeof CompositionPlanSchema>;
export type PictureJobRequest = z.infer<typeof PictureJobRequestSchema>;
export type PictureRevisionRequest = z.infer<typeof PictureRevisionRequestSchema>;
export type ManifestEntry = z.infer<typeof ManifestEntrySchema>;
