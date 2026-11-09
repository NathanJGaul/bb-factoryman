import { existsSync } from "node:fs";
import { basename } from "node:path";
import { expect, it } from "vitest";

// This file has no setup of its own. It checks what the root vitest config gives every test file.
it("[U1532] starts with TMPDIR pointing at a private directory that the setup file made", () => {
  const dir = process.env["TMPDIR"] ?? "";
  expect(basename(dir)).toMatch(/^bb-factoryman-test-/);
  expect(existsSync(dir)).toBe(true);
});
