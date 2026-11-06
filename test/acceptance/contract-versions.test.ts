import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * `spike/RESULTS.md` records bb facts for one bb version and one SDK version.
 * These tests fail when the pinned versions drift from that record, so an
 * upgrade forces a new spike before anyone trusts the old results.
 */

interface Manifest {
  devDependencies?: Record<string, string>;
}

const root = new URL("../../", import.meta.url);
const manifest = JSON.parse(readFileSync(new URL("package.json", root), "utf8")) as Manifest;
const results = readFileSync(new URL("spike/RESULTS.md", root), "utf8");

/** Read a cell from the Environment table in `spike/RESULTS.md`. */
function recorded(part: string): string {
  const row = results.split("\n").find((line) => line.startsWith(`| ${part} |`));
  if (row === undefined) throw new Error(`spike/RESULTS.md has no Environment row for ${part}.`);
  const cell = row.split("|")[2]?.trim();
  if (cell === undefined || cell === "") throw new Error(`The Environment row for ${part} is empty.`);
  return cell;
}

describe("recorded bb contract versions", () => {
  it("pins the plugin SDK to the version the spike recorded", () => {
    expect(manifest.devDependencies?.["@get-bb/plugin-sdk"]).toBe(recorded("`@get-bb/plugin-sdk`"));
  });

  it("installs the SDK version the spike recorded", () => {
    const installed = JSON.parse(
      readFileSync(new URL("node_modules/@get-bb/plugin-sdk/package.json", root), "utf8"),
    ) as { version: string };
    expect(installed.version).toBe(recorded("`@get-bb/plugin-sdk`"));
  });

  it("stamps every recorded bb fixture with the recorded bb and SDK versions", () => {
    for (const name of ["thread-events.json", "request-input-outcomes.json"]) {
      const fixture = JSON.parse(
        readFileSync(new URL(`test/fixtures/recorded/bb-0.48.1/${name}`, root), "utf8"),
      ) as { bbVersion: string; sdk: string };
      expect(fixture.bbVersion, name).toBe(recorded("bb CLI and server"));
      expect(fixture.sdk, name).toBe(recorded("`@get-bb/plugin-sdk`"));
    }
  });

  it("records the no-mistakes version that the no-mistakes fixtures are named for", () => {
    expect(recorded("no-mistakes")).toBe("v1.84.0");
  });
});
