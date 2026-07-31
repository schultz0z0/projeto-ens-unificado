import { expect, test } from "bun:test";
import sharp from "sharp";

import { composite } from "../src/compositor.ts";
import { PictureError } from "../src/errors.ts";
import type { Overlay } from "../src/types.ts";

const canvas = async (width = 200, height = 200) => sharp({
  create: {
    width,
    height,
    channels: 4,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  },
}).png().toBuffer();

const alphaAt = async (image: Buffer, x: number, y: number) => {
  const { data } = await sharp(image)
    .extract({ left: x, top: y, width: 1, height: 1 })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return data[3];
};

test("shape top-left anchor starts at the requested pixel coordinate", async () => {
  const output = await composite(await canvas(), [{
    type: "shape",
    shape: "rect",
    zone: { x: 10, y: 20, unit: "px" },
    anchor: "top-left",
    width: 30,
    height: 20,
    fill: "#ff0000",
  }], 200, 200, process.cwd());

  expect(await alphaAt(output, 0, 20)).toBe(0);
  expect(await alphaAt(output, 10, 20)).toBe(255);
  expect(await alphaAt(output, 39, 39)).toBe(255);
  expect(await alphaAt(output, 40, 40)).toBe(0);
});

test("rotated shape keeps its effective bounding box anchored at top-left", async () => {
  const output = await composite(await canvas(), [{
    type: "shape",
    shape: "rect",
    zone: { x: 50, y: 60, unit: "px" },
    anchor: "top-left",
    width: 40,
    height: 20,
    rotation: 90,
    fill: "#ff0000",
  }], 200, 200, process.cwd());

  expect(await alphaAt(output, 50, 60)).toBe(255);
  expect(await alphaAt(output, 69, 99)).toBe(255);
  expect(await alphaAt(output, 70, 99)).toBe(0);
  expect(await alphaAt(output, 49, 60)).toBe(0);
});

test("non-bleeding shape outside the canvas fails before publication", async () => {
  const render = composite(await canvas(), [{
    type: "shape",
    shape: "rect",
    zone: { x: 150, y: 20, unit: "px" },
    anchor: "top-left",
    width: 100,
    height: 20,
    fill: "#ff0000",
  }], 200, 200, process.cwd());

  await expect(render).rejects.toMatchObject({
    code: "picture_overlay_out_of_bounds",
  });
});

test("decorative shape may intentionally bleed outside the canvas", async () => {
  const output = await composite(await canvas(), [{
    type: "shape",
    shape: "rect",
    zone: { x: 150, y: 20, unit: "px" },
    anchor: "top-left",
    width: 100,
    height: 20,
    fill: "#ff0000",
    allowBleed: true,
  }], 200, 200, process.cwd());

  expect(await alphaAt(output, 199, 20)).toBe(255);
});

test("text outside the canvas fails with a layout error before loading fonts", async () => {
  const overlays: Overlay[] = [{
    type: "satori-text",
    jsx: { tag: "div", children: ["CTA"] },
    zone: { x: 180, y: 20, unit: "px" },
    anchor: "top-left",
    width: 80,
    height: 40,
  }];

  try {
    await composite(await canvas(), overlays, 200, 200, process.cwd());
    throw new Error("Expected composition to fail");
  } catch (error) {
    expect(error).toBeInstanceOf(PictureError);
    expect((error as PictureError).code).toBe("picture_overlay_out_of_bounds");
  }
});
