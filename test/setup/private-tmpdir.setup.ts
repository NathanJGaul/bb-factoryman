import { afterAll } from "vitest";
import { createPrivateTmpdir } from "./private-tmpdir.ts";

// A `vitest` setup file. It runs before each test file loads, so `TMPDIR` is private before any module asks for a temporary directory.
// It removes the directory after the file, whether the tests passed, failed, or timed out, and again when the worker exits.
const privateTmpdir = createPrivateTmpdir();
afterAll(() => privateTmpdir.restore());
process.once("exit", () => privateTmpdir.restore());
