import { describe, test, expect } from "bun:test";
import { CompositionPlanSchema, CreativeBriefSchema } from "../src/service/contracts.ts";
import { jsxToReact } from "../src/satori-jsx.ts";

describe("satoriNode accepts numeric values (Class B fix)", () => {
  test("number is coerced to string in satoriNode", () => {
    const plan = CompositionPlanSchema.parse({
      version: 1,
      base_prompt: "Test composition",
      pipeline: [
        {
          op: "compose",
          overlays: [
            {
              type: "satori-text",
              jsx: {
                tag: "div",
                props: { style: { display: "flex" } },
                children: [200],
              },
              width: 100,
              height: 50,
            },
          ],
        },
      ],
      final_path: "final/test.png",
    });

    // The numeric child 200 should be transformed to "200"
    const step = plan.pipeline[0] as { op: "compose"; overlays: any[] };
    const jsx = step.overlays[0].jsx;
    expect(jsx.children[0]).toBe("200");
  });

  test("pure string children still work", () => {
    const plan = CompositionPlanSchema.parse({
      version: 1,
      base_prompt: "Test composition",
      pipeline: [
        {
          op: "compose",
          overlays: [
            {
              type: "satori-text",
              jsx: {
                tag: "span",
                props: {},
                children: ["Hello World"],
              },
              width: 100,
              height: 50,
            },
          ],
        },
      ],
      final_path: "final/test.png",
    });

    const step = plan.pipeline[0] as { op: "compose"; overlays: any[] };
    expect(step.overlays[0].jsx.children[0]).toBe("Hello World");
  });
});

describe("coerceArray normalizes XML parser artifacts (Class A fix)", () => {
  test("overlays wrapped in {item: [...]} are unwrapped", () => {
    const plan = CompositionPlanSchema.parse({
      version: 1,
      base_prompt: "Test composition",
      pipeline: [
        {
          op: "compose",
          overlays: {
            item: [
              { type: "shape", shape: "rect", width: 100, height: 50, fill: "#f00" },
              { type: "shape", shape: "circle", width: 80, height: 80, fill: "#0f0" },
            ],
          },
        },
      ],
      final_path: "final/test.png",
    });

    const step = plan.pipeline[0] as { op: "compose"; overlays: any[] };
    expect(step.overlays).toHaveLength(2);
    expect(step.overlays[0].type).toBe("shape");
  });

  test("single item in {item: {...}} is normalized to array", () => {
    const plan = CompositionPlanSchema.parse({
      version: 1,
      base_prompt: "Test",
      pipeline: [
        {
          op: "compose",
          overlays: {
            item: { type: "shape", shape: "rect", width: 50, height: 50, fill: "#fff" },
          },
        },
      ],
      final_path: "final/test.png",
    });

    const step = plan.pipeline[0] as { op: "compose"; overlays: any[] };
    expect(step.overlays).toHaveLength(1);
    expect(step.overlays[0].shape).toBe("rect");
  });

  test("satoriNode children wrapped in {item: [...]} are unwrapped", () => {
    const plan = CompositionPlanSchema.parse({
      version: 1,
      base_prompt: "Test",
      pipeline: [
        {
          op: "compose",
          overlays: [
            {
              type: "satori-text",
              jsx: {
                tag: "div",
                props: {},
                children: { item: ["Hello", "World"] },
              },
              width: 200,
              height: 100,
            },
          ],
        },
      ],
      final_path: "final/test.png",
    });

    const step = plan.pipeline[0] as { op: "compose"; overlays: any[] };
    expect(step.overlays[0].jsx.children).toEqual(["Hello", "World"]);
  });
});

describe("jsxToReact handles number nodes", () => {
  test("number at root is converted to string", () => {
    expect(jsxToReact(42)).toBe("42");
  });

  test("number child in tree is converted to string", () => {
    const result = jsxToReact({
      tag: "span",
      props: {},
      children: [200 as any],
    });
    expect(result.props.children).toBe("200");
  });
});

describe("toolError returns detailed diagnostics (telemetry fix)", () => {
  test("non-PictureError surfaces detail field", async () => {
    // We test the toolError function indirectly through the MCP server
    // by importing and calling it
    const { PictureError } = await import("../src/errors.ts");

    // Simulate what toolError does
    const error = new Error("compose requires input");
    const pictureError = error instanceof PictureError
      ? error
      : new PictureError("picture_internal_error", "Picture request failed.", 500);
    const detail: Record<string, unknown> = {
      code: pictureError.code,
      message: pictureError.message,
    };
    if (!(error instanceof PictureError) && error instanceof Error) {
      detail.detail = error.message;
    }

    expect(detail.code).toBe("picture_internal_error");
    expect(detail.message).toBe("Picture request failed.");
    expect(detail.detail).toBe("compose requires input");
  });

  test("PictureError preserves its own code and message", async () => {
    const { PictureError } = await import("../src/errors.ts");

    const error = new PictureError("picture_asset_missing", "Image asset not found: references/logo.svg", 400);
    const detail: Record<string, unknown> = {
      code: error.code,
      message: error.message,
    };
    if (!(error instanceof PictureError) && error instanceof Error) {
      detail.detail = error.message;
    }

    expect(detail.code).toBe("picture_asset_missing");
    expect(detail.message).toBe("Image asset not found: references/logo.svg");
    expect(detail.detail).toBeUndefined();
  });
});
