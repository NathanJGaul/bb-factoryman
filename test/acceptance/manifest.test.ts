import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

interface Manifest {
  name?: string;
  keywords?: string[];
  scripts?: Record<string, string>;
  devDependencies?: Record<string, string>;
  bb?: { name?: string; description?: string; server?: string; app?: string; branding?: { icon?: string } };
}

interface TsConfig {
  compilerOptions?: { lib?: string[]; jsx?: string };
  include?: string[];
}

const manifest = JSON.parse(
  readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
) as Manifest;
const tsconfig = JSON.parse(
  readFileSync(new URL("../../tsconfig.json", import.meta.url), "utf8"),
) as TsConfig;

describe("package manifest", () => {
  it("names the package, declares the server entry, and pins the SDK to one exact version", () => {
    expect(manifest.name).toBe("bb-factoryman");
    expect(manifest.bb?.server).toBe("./src/server.ts");
    expect(manifest.bb?.name).toBe("Factory Man");
    expect(manifest.bb?.description).toMatch(/delivery contract.*approval gates/);
    expect(manifest.bb?.branding?.icon).toBe("Factory");
    expect(manifest.keywords).toContain("bb-plugin");
    expect(manifest.devDependencies?.["@get-bb/plugin-sdk"]).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("builds through bb plugin build", () => {
    expect(manifest.scripts?.build).toBe("bb plugin build");
  });

  it("[A1214] runs the type check with tsc6, the binary that the pinned TypeScript installs, and not with a global tsc", () => {
    const script = manifest.scripts?.typecheck ?? "";
    expect(script).toMatch(/^tsc6(\s|$)/);
    expect(script).not.toMatch(/(^|[\s&;|])tsc(\s|$)/);
    expect(existsSync(new URL("../../node_modules/.bin/tsc6", import.meta.url)), "node_modules/.bin/tsc6 should exist").toBe(true);
    expect(manifest.scripts?.check).toContain("pnpm run typecheck");
  });

  it("[A1215] type-checks the frontend source: src is included, with the JSX transform and the DOM library", () => {
    expect(tsconfig.include).toContain("src");
    expect(tsconfig.compilerOptions?.jsx).toBe("react-jsx");
    expect(tsconfig.compilerOptions?.lib).toContain("DOM");
  });
});
