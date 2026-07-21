import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { ensureFalKey, readInput } from "../src/operations.ts";

let temporaryHome = "";
let originalHome: string | undefined;
let originalFalKey: string | undefined;
let originalExit: typeof process.exit;

beforeEach(async () => {
  temporaryHome = await mkdtemp(path.join(tmpdir(), "picture-config-"));
  originalHome = process.env.HOME;
  originalFalKey = process.env.FAL_KEY;
  originalExit = process.exit;
  process.env.HOME = temporaryHome;
  delete process.env.FAL_KEY;
  process.exit = ((code?: number) => {
    const error = new Error("process_exit_called") as Error & { exitCode?: number };
    error.exitCode = code;
    throw error;
  }) as typeof process.exit;
});

afterEach(async () => {
  process.exit = originalExit;
  if (originalHome === undefined) delete process.env.HOME;
  else process.env.HOME = originalHome;
  if (originalFalKey === undefined) delete process.env.FAL_KEY;
  else process.env.FAL_KEY = originalFalKey;
  await rm(temporaryHome, { recursive: true, force: true });
});

describe("library errors", () => {
  test("missing FAL key throws a typed error instead of exiting", () => {
    let caught: unknown;
    try {
      ensureFalKey();
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error & { code?: string }).code).toBe("picture_config_missing_fal_key");
  });

  test("missing input throws a typed error instead of exiting", async () => {
    let caught: unknown;
    try {
      await readInput(path.join(temporaryHome, "missing.png"));
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error & { code?: string }).code).toBe("picture_input_not_found");
  });
});
