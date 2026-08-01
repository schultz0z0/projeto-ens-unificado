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
        { type: "image" as const, src: "references/ENS Logo White.PNG", zone: "top-left-safe" as const },
        {
          type: "satori-text" as const,
          jsx: { tag: "div", children: ["Graduação que transforma"] },
          zone: "title-area" as const,
        },
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
    "references/ENS Logo White.PNG",
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

test("materializes a reference at the exact manifest path consumed by the composition plan", async () => {
  const { PicturePackageBuilder } = await loadBuilder();
  const builder = new PicturePackageBuilder({
    artifactClient: {
      async downloadArtifact() {
        return { bytes: Buffer.from("reference"), contentType: "image/png" };
      },
    },
  });
  const referencePath = "references/Modelos P_s.png";
  const result = await builder.build({
    workspaceId: WORKSPACE,
    jobId: "job-reference-path",
    creativeBrief: brief,
    compositionPlan: {
      ...plan,
      pipeline: [{
        op: "compose" as const,
        size: "1080x1350",
        overlays: [{
          type: "image" as const,
          src: referencePath,
          zone: { x: 0, y: 0, unit: "px" as const },
          anchor: "top-left" as const,
          width: 1080,
          height: 1350,
        }],
      }],
    },
    referenceArtifactIds: [REFERENCE],
    manifest: [{
      artifact_id: REFERENCE,
      workspace_id: WORKSPACE,
      relative_path: referencePath,
      category: "reference",
      content_type: "image/png",
      size: 9,
      lifecycle: "workspace",
      created_at: "2026-08-01T16:39:00.000Z",
    }],
  });
  roots.push(result.root);

  await access(join(result.root, ...referencePath.split("/")));
});

test("rejects reference metadata whose path is outside the references directory", async () => {
  const { PicturePackageBuilder } = await loadBuilder();
  const builder = new PicturePackageBuilder({
    artifactClient: {
      async downloadArtifact() {
        return { bytes: Buffer.from("reference"), contentType: "image/png" };
      },
    },
  });

  await expect(builder.build({
    workspaceId: WORKSPACE,
    jobId: "job-invalid-reference-path",
    creativeBrief: brief,
    compositionPlan: plan,
    referenceArtifactIds: [REFERENCE],
    manifest: [{
      artifact_id: REFERENCE,
      workspace_id: WORKSPACE,
      relative_path: "final/overwrite.png",
      category: "reference",
      content_type: "image/png",
      size: 9,
      lifecycle: "workspace",
      created_at: "2026-08-01T16:39:00.000Z",
    }],
  })).rejects.toMatchObject({ code: "picture_reference_path_invalid" });
});
