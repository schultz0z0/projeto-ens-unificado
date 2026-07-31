import { expect, test } from "bun:test";

import { resolvePosition } from "../src/zones.ts";

test("explicit position units distinguish pixels from percentages", () => {
  expect(resolvePosition(
    { x: 72, y: 80, unit: "px" },
    1_000,
    1_000,
    100,
    50,
    "top-left",
  )).toEqual({ x: 72, y: 80 });

  expect(resolvePosition(
    { x: 72, y: 80, unit: "percent" },
    1_000,
    1_000,
    100,
    50,
    "top-left",
  )).toEqual({ x: 720, y: 800 });
});

test("unitless positions preserve the legacy percentage-or-pixel heuristic", () => {
  expect(resolvePosition(
    { x: 72, y: 120 },
    1_000,
    1_000,
    100,
    50,
    "top-left",
  )).toEqual({ x: 720, y: 120 });
});
