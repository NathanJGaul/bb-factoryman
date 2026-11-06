import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

interface Manifest {
  name?: string;
  keywords?: string[];
  scripts?: Record<string, string>;
  devDependencies?: Record<string, string>;
  bb?: { name?: string; description?: string; server?: string; branding?: { icon?: string } };
}

const manifest = JSON.parse(
  readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
) as Manifest;

describe("package manifest", () => {
  it("names the package, declares the server entry, and pins the SDK to one exact version", () => {
    expect(manifest.name).toBe("bb-factoryman");
    expect(manifest.bb?.server).toBe("./src/server.ts");
    expect(manifest.bb?.name).toBeTruthy();
    expect(manifest.bb?.description).toBeTruthy();
    expect(manifest.bb?.branding?.icon).toBeTruthy();
    expect(manifest.keywords).toContain("bb-plugin");
    expect(manifest.devDependencies?.["@get-bb/plugin-sdk"]).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("builds through bb plugin build", () => {
    expect(manifest.scripts?.build).toBe("bb plugin build");
  });
});
