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
  exclude?: string[];
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

  it("[A1214] runs the type check with a binary that the pinned TypeScript package installs, and the check script runs it", () => {
    const binary = (manifest.scripts?.typecheck ?? "").trim().split(/\s+/)[0];
    const installed = JSON.parse(
      readFileSync(new URL("../../node_modules/typescript/package.json", import.meta.url), "utf8"),
    ) as { bin?: string | Record<string, string> };
    expect(typeof installed.bin === "object" ? Object.keys(installed.bin) : []).toContain(binary);
    expect(manifest.scripts?.check).toContain("pnpm run typecheck");
  });

  it("[A1215] type-checks the frontend source: src is included and not excluded, with the JSX transform and the DOM library", () => {
    expect(tsconfig.include).toContain("src");
    expect((tsconfig.exclude ?? []).filter((path) => path === "src" || path.startsWith("src/"))).toEqual([]);
    expect(tsconfig.compilerOptions?.jsx).toBe("react-jsx");
    expect((tsconfig.compilerOptions?.lib ?? []).map((name) => name.toUpperCase())).toContain("DOM");
  });

  it("[A1220] declares the frontend entry as ./src/app.tsx, which exists", () => {
    expect(manifest.bb?.app).toBe("./src/app.tsx");
    expect(existsSync(new URL("../../src/app.tsx", import.meta.url)), "src/app.tsx should exist").toBe(true);
  });
});
