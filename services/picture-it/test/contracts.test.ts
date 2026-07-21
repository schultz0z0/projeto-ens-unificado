import { expect, test } from "bun:test";

const loadContracts = async () => {
  try {
    return await import("../src/service/contracts.ts");
  } catch (error) {
    expect(error).toBeUndefined();
    throw error;
  }
};

const validBrief = {
  title: "Graduação — Gestão Financeira",
  campaign_type: "graduacao",
  channel: "whatsapp",
  objective: "captacao",
  audience: "adultos buscando diploma superior",
  offer: "Gestão Financeira",
  copy_points: ["alta taxa de empregabilidade", "diploma superior em 2 anos"],
  cta: "Matricule-se",
  visual_style: "institucional, clean, premium",
  brand_profile: "ens_graduacoes",
  output: { width: 1080, height: 1080, format: "png" },
};

const validPlan = {
  version: 1,
  base_prompt: "Fotografia publicitária institucional sem texto.",
  pipeline: [
    { op: "generate", prompt: "Fundo institucional", model: "banana-pro", size: "1080x1080" },
    { op: "grade", name: "warm-editorial" },
    { op: "compose", overlays_file: "planning/overlays.json" },
  ],
  final_path: "final/peca-final.png",
};

test("CreativeBrief accepts the approved briefing contract", async () => {
  const { CreativeBriefSchema } = await loadContracts();
  expect(CreativeBriefSchema.parse(validBrief).output).toEqual({
    width: 1080,
    height: 1080,
    format: "png",
  });
});

test("CreativeBrief rejects unsafe output dimensions", async () => {
  const { CreativeBriefSchema } = await loadContracts();
  expect(() => CreativeBriefSchema.parse({
    ...validBrief,
    output: { width: 20_000, height: 1080, format: "png" },
  })).toThrow();
});

test("CompositionPlan accepts the full structured plan", async () => {
  const { CompositionPlanSchema } = await loadContracts();
  expect(CompositionPlanSchema.parse(validPlan).pipeline).toHaveLength(3);
});

test("CompositionPlan rejects unknown operations", async () => {
  const { CompositionPlanSchema } = await loadContracts();
  expect(() => CompositionPlanSchema.parse({
    ...validPlan,
    pipeline: [{ op: "shell", command: "whoami" }],
  })).toThrow();
});

test("CompositionPlan rejects traversal and absolute paths", async () => {
  const { CompositionPlanSchema } = await loadContracts();
  for (const overlays_file of ["../secret.json", "/etc/passwd", "C:/Windows/win.ini"]) {
    expect(() => CompositionPlanSchema.parse({
      ...validPlan,
      pipeline: [{ op: "compose", overlays_file }],
    })).toThrow();
  }
});

test("PictureJobRequest requires UUID ownership and idempotency", async () => {
  const { PictureJobRequestSchema } = await loadContracts();
  const request = PictureJobRequestSchema.parse({
    workspace_id: "11111111-1111-4111-8111-111111111111",
    creative_brief: validBrief,
    composition_plan: validPlan,
    reference_artifact_ids: ["22222222-2222-4222-8222-222222222222"],
    idempotency_key: "turn-001",
  });
  expect(request.idempotency_key).toBe("turn-001");
});

test("ManifestEntry validates safe relative artifacts", async () => {
  const { ManifestEntrySchema } = await loadContracts();
  const entry = ManifestEntrySchema.parse({
    artifact_id: "22222222-2222-4222-8222-222222222222",
    workspace_id: "11111111-1111-4111-8111-111111111111",
    relative_path: "planning/steps.json",
    category: "planning",
    content_type: "application/json",
    size: 961,
    lifecycle: "workspace",
    created_at: "2026-07-21T19:45:00.000Z",
  });
  expect(entry.relative_path).toBe("planning/steps.json");
});
