import { afterEach, expect, test } from "bun:test";
import { access, readFile, rm } from "node:fs/promises";
import { join } from "node:path";

const WORKSPACE = "11111111-1111-4111-8111-111111111111";
const REFERENCE = "22222222-2222-4222-8222-222222222222";
const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

const loadBuilder = async () => {
  try {
    return await import("../src/service/package-builder.ts");
  } catch (error) {
    expect(error).toBeUndefined();
    throw error;
  }
};

const brief = {
  title: "Graduação EAD",
  campaign_type: "captação",
  channel: "Instagram",
  objective: "Gerar matrículas",
  audience: "Adultos buscando graduação",
  offer: "Mensalidades acessíveis",
  copy_points: ["Diploma reconhecido", "Estude de onde estiver"],
  cta: "Inscreva-se",
  visual_style: "Editorial premium azul",
  brand_profile: "ENS",
  output: { width: 1080, height: 1350, format: "png" as const },
};

const plan = {
  version: 1 as const,
  base_prompt: "Ambiente universitário brasileiro contemporâneo",
  pipeline: [
    { op: "generate" as const, prompt: "Estudante em campus", size: "1080x1350" },
    {
      op: "compose" as const,
      overlays: [
        { type: "image" as const, src: "references/ens-logo-white.png", zone: "top-left-safe" as const },
        { type: "satori-text" as const, jsx: "Graduação que transforma", zone: "title-area" as const },
      ],
    },
  ],
  final_path: "final/peca-final.png",
};

test("builds a deterministic complex briefing package", async () => {
  const { PicturePackageBuilder } = await loadBuilder();
  const builder = new PicturePackageBuilder({
    artifactClient: {
      async downloadArtifact(id: string) {
        expect(id).toBe(REFERENCE);
        return { bytes: Buffer.from("logo"), contentType: "image/png" };
      },
    },
  });
  const result = await builder.build({
    workspaceId: WORKSPACE,
    jobId: "job-1",
    creativeBrief: brief,
    compositionPlan: plan,
    referenceArtifactIds: [REFERENCE],
    manifest: [{
      artifact_id: REFERENCE,
      workspace_id: WORKSPACE,
      relative_path: "references/ENS Logo White.PNG",
      category: "reference",
      content_type: "image/png",
      size: 4,
      lifecycle: "workspace",
      created_at: "2026-07-21T12:00:00.000Z",
    }],
  });
  roots.push(result.root);

  const expected = [
    "brief/brief.json",
    "planning/prompt.txt",
    "planning/composition-plan.json",
    "planning/steps.json",
    "planning/overlays.json",
    "references/ens-logo-white.png",
  ];
  for (const path of expected) await access(join(result.root, path));
  expect(result.finalPath).toBe(join(result.root, "final", "peca-final.png"));
  expect(JSON.parse(await readFile(join(result.root, "brief", "brief.json"), "utf8")).title).toBe("Graduação EAD");
  expect(JSON.parse(await readFile(join(result.root, "planning", "overlays.json"), "utf8"))).toHaveLength(2);
});

test("only materializes references present in the owned manifest", async () => {
  const { PicturePackageBuilder } = await loadBuilder();
  const builder = new PicturePackageBuilder({ artifactClient: { async downloadArtifact() { return { bytes: Buffer.from("x"), contentType: "image/png" }; } } });
  await expect(builder.build({
    workspaceId: WORKSPACE,
    jobId: "job-2",
    creativeBrief: brief,
    compositionPlan: plan,
    referenceArtifactIds: [REFERENCE],
    manifest: [],
  })).rejects.toMatchObject({ code: "picture_reference_not_owned" });
});
