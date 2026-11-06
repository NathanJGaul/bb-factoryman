import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

const rootDir = fileURLToPath(new URL("../../", import.meta.url));
const eslint = new ESLint({ cwd: rootDir });

/** Lint a code string as if it lived at `filePath`, and return the import restriction messages. */
async function importRestrictions(filePath: string, code: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath: join(rootDir, filePath) });
  return (result?.messages ?? [])
    .filter((m) => m.ruleId === "no-restricted-imports" || m.ruleId === "no-restricted-syntax")
    .map((m) => m.message);
}

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
