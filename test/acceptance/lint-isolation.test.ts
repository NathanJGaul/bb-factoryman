import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { ESLint } from "eslint";
import { beforeAll, describe, expect, it } from "vitest";

const rootDir = fileURLToPath(new URL("../../", import.meta.url));
const eslint = new ESLint({ cwd: rootDir });

/** Lint a code string as if it lived at `filePath`, and return the import restriction messages. */
async function importRestrictions(filePath: string, code: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath: join(rootDir, filePath) });
  // A "passes lint" answer is only worth something if ESLint really linted the file.
  const messages = result?.messages ?? [];
  expect(messages.filter((m) => m.fatal), `parse error in fixture for ${filePath}`).toEqual([]);
  expect(messages.filter((m) => /ignored/i.test(m.message)), `${filePath} was ignored by ESLint`).toEqual([]);
  return messages
    .filter((m) => m.ruleId === "no-restricted-imports" || m.ruleId === "no-restricted-syntax")
    .map((m) => m.message);
}

// The first lint in a file loads the ESLint config and the type-aware parser. Under a full-suite run that took 8 s and
// used up the first test's own 5 s budget, so the test failed at random. A warm-up with its own budget fixes that
// without a longer timeout on any assertion.
beforeAll(async () => {
  await eslint.lintText("export {};\n", { filePath: join(rootDir, "src/store/warm-up.ts") });
}, 60_000);

const BB_IMPORT = 'import { createFakePluginHost } from "@get-bb/plugin-sdk";\nexport const host = createFakePluginHost;\n';

describe("src/machine isolation from bb", () => {
  it("fails lint on an @get-bb import and names the restricted module", async () => {
    const messages = await importRestrictions("src/machine/probe.ts", BB_IMPORT);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain("@get-bb/plugin-sdk");
  });

  it("passes lint on the same import outside src/machine", async () => {
    expect(await importRestrictions("src/store/probe.ts", BB_IMPORT)).toEqual([]);
    expect(await importRestrictions("src/server.ts", BB_IMPORT)).toEqual([]);
  });

  it("fails lint on a type-only @get-bb import", async () => {
    const code = 'import type { BbPluginApi } from "@get-bb/plugin-sdk";\nexport type Api = BbPluginApi;\n';
    expect(await importRestrictions("src/machine/probe.ts", code)).toHaveLength(1);
  });

  it("fails lint on an @get-bb subpath import", async () => {
    const code = 'import { createFakePluginHost } from "@get-bb/plugin-sdk/testing";\nexport const host = createFakePluginHost;\n';
    const messages = await importRestrictions("src/machine/probe.ts", code);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain("@get-bb/plugin-sdk/testing");
  });

  it("fails lint on a dynamic import of an @get-bb module", async () => {
    const code = 'export const load = () => import("@get-bb/plugin-sdk");\n';
    expect(await importRestrictions("src/machine/probe.ts", code)).toHaveLength(1);
  });

  it("fails lint on a re-export from an @get-bb module", async () => {
    expect(await importRestrictions("src/machine/probe.ts", 'export * from "@get-bb/plugin-sdk";\n')).toHaveLength(1);
    expect(await importRestrictions("src/machine/probe.ts", 'export { createFakePluginHost } from "@get-bb/plugin-sdk";\n')).toHaveLength(1);
  });
});

describe("src/machine purity", () => {
  it("fails lint on an import of better-sqlite3", async () => {
    const code = 'import Database from "better-sqlite3";\nexport const db = Database;\n';
    expect(await importRestrictions("src/machine/probe.ts", code)).toHaveLength(1);
  });

  it("fails lint on an import of a node built-in, with or without the node: prefix", async () => {
    const prefixed = 'import { readFileSync } from "node:fs";\nexport const read = readFileSync;\n';
    const bare = 'import { readFileSync } from "fs";\nexport const read = readFileSync;\n';
    expect(await importRestrictions("src/machine/probe.ts", prefixed)).toHaveLength(1);
    expect(await importRestrictions("src/machine/probe.ts", bare)).toHaveLength(1);
  });

  it("fails lint on an import from src/store", async () => {
    const code = 'import { TaskLog } from "../store/task-log";\nexport const log = TaskLog;\n';
    expect(await importRestrictions("src/machine/probe.ts", code)).toHaveLength(1);
  });

  it("passes lint on xstate, zod, and sibling machine imports", async () => {
    const code = [
      'import { createMachine } from "xstate";',
      'import { z } from "zod";',
      'import { shape } from "./types";',
      "export const parts = [createMachine, z, shape];",
      "",
    ].join("\n");
    expect(await importRestrictions("src/machine/probe.ts", code)).toEqual([]);
  });

  it("passes lint on a sibling module whose name matches a Node built-in", async () => {
    const code = [
      'import { parseEvent } from "./events";',
      'import { join } from "./path";',
      'import { format } from "../machine/util";',
      "export const parts = [parseEvent, join, format];",
      "",
    ].join("\n");
    expect(await importRestrictions("src/machine/probe.ts", code)).toEqual([]);
  });
});

describe("browser-side isolation from the server", () => {
  const browserFiles = ["src/app.tsx", "src/app/probe.tsx", "src/approval/probe.ts"];
  const rejected: Array<[string, string]> = [
    ["a node: built-in", 'import { readFileSync } from "node:fs";\nexport const read = readFileSync;\n'],
    ["a bare node built-in", 'import { join } from "path";\nexport const j = join;\n'],
    ["better-sqlite3", 'import Database from "better-sqlite3";\nexport const db = Database;\n'],
    ["zod", 'import { z } from "zod";\nexport const s = z;\n'],
    ["the backend SDK root", 'import type { BbPluginApi } from "@get-bb/plugin-sdk";\nexport type Api = BbPluginApi;\n'],
    ["the SDK test harness", 'import { createFakePluginHost } from "@get-bb/plugin-sdk/testing";\nexport const host = createFakePluginHost;\n'],
    ["src/store", 'import { TaskLog } from "../store/task-log";\nexport const log = TaskLog;\n'],
    ["src/tools", 'import { merge } from "../tools/merge";\nexport const m = merge;\n'],
    ["src/machine", 'import { transition } from "../machine/transition";\nexport const t = transition;\n'],
    ["src/runtime", 'import { createRuntime } from "../runtime";\nexport const r = createRuntime;\n'],
  ];
  const accepted = [
    'import { definePluginApp } from "@get-bb/plugin-sdk/app";\nexport const app = definePluginApp;\n',
    'import { useState } from "react";\nexport const s = useState;\n',
    'import { MERGE_RENDERER_ID } from "./contract";\nexport const id = MERGE_RENDERER_ID;\n',
    'import { MERGE_RENDERER_ID } from "../approval/contract";\nexport const id = MERGE_RENDERER_ID;\n',
  ];

  const rejectedInEachFile = browserFiles.flatMap((file) => rejected.map(([name, code]) => [file, name, code] as const));
  it.each(rejectedInEachFile)("[A1221a] fails lint on %s importing %s", async (file, _name, code) => {
    expect(await importRestrictions(file, code)).toHaveLength(1);
  });

  const acceptedInEachFile = browserFiles.flatMap((file) => accepted.map((code) => [file, (code.split("\n")[0] ?? "").trim(), code] as const));
  it.each(acceptedInEachFile)("[A1221b] passes lint on %s with %s", async (file, _line, code) => {
    expect(await importRestrictions(file, code)).toEqual([]);
  });

  it.each(rejected)("[A1221c] passes lint on a server file that imports %s", async (_name, code) => {
    expect(await importRestrictions("src/tools/probe.ts", code)).toEqual([]);
  });

  it.each(["src/app/probe.test.tsx", "src/approval/probe.test.ts"])("[A1221c] passes lint on server imports in the browser side's own test %s", async (file) => {
    const fixtureImport = 'import { loadWorld } from "../../test/fixtures/plugin-host";\nimport { merge } from "../tools/merge";\nimport { z } from "zod";\nexport const t = [loadWorld, merge, z];\n';
    expect(await importRestrictions(file, fixtureImport)).toEqual([]);
  });
});

describe("harness table isolation", () => {
  // The third column is the number of messages ESLint reports. A bare Node built-in matches both the path rule and the pattern rule, so it reports twice.
  const rejected: Array<[string, string, number]> = [
    ["an @get-bb module", 'import type { BbPluginApi } from "@get-bb/plugin-sdk";\nexport type Api = BbPluginApi;\n', 1],
    ["a node: built-in", 'import { readFileSync } from "node:fs";\nexport const read = readFileSync;\n', 1],
    ["a bare node built-in", 'import { join } from "path";\nexport const j = join;\n', 2],
    ["a package", 'import { z } from "zod";\nexport const s = z;\n', 1],
    ["a sibling module", 'import { other } from "./other";\nexport const o = other;\n', 1],
    ["another plugin layer", 'import { TaskLog } from "../store/task-log";\nexport const log = TaskLog;\n', 1],
    ["a type from another layer", 'import type { Profile } from "../machine/types";\nexport type P = Profile;\n', 1],
    ["a dynamic import", 'export const load = () => import("./other");\n', 1],
    ["a re-export", 'export * from "./other";\n', 1],
  ];

  it.each(rejected)("[A1312] fails lint on src/harness importing %s", async (_name, code, count) => {
    const messages = await importRestrictions("src/harness/probe.ts", code);
    expect(messages).toHaveLength(count);
    for (const message of messages) expect(message).toContain("data only");
  });

  it.each(rejected)("[A1312] passes lint on %s in another server layer", async (_name, code) => {
    expect(await importRestrictions("src/dispatch/probe.ts", code)).toEqual([]);
  });

  it("[A1312] passes lint on any import in the table's own test file", async () => {
    const code = 'import { describe } from "vitest";\nimport { contractFor } from "./contracts";\nexport const t = [describe, contractFor];\n';
    expect(await importRestrictions("src/harness/probe.test.ts", code)).toEqual([]);
  });
});
