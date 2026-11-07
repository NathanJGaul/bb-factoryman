import { describe, expect, it } from "vitest";
import { REGISTRY } from "../../test/fixtures/registry";
import { parseRegistry } from "./registry";

const parse = (line: string) => parseRegistry(line).entries[0];

describe("parseRegistry", () => {
  it("[U1022] parses name, mode, yolo, prefix, forge, and description, with the bracket tokens in any order", () => {
    expect(parse("- gizmos [direct-PR +yolo] - Direct pull requests (added 2026-03-04)")).toMatchObject({ name: "gizmos", registeredMode: "direct-PR", mode: "direct-PR", yolo: true, branchPrefix: "fm/", forge: "none", description: "Direct pull requests (added 2026-03-04)", flags: [] });
    expect(parse("- a [+yolo local-only branch=wip/ forge=gerrit] - d")).toMatchObject({ mode: "local-only", yolo: true, branchPrefix: "wip/", forge: "gerrit" });
    expect(parse("- a [branch=wip/ no-mistakes] - d")).toMatchObject({ mode: "no-mistakes", yolo: false, branchPrefix: "wip/" });
  });

  it("[U1023] reads a line with no bracket as no-mistakes with yolo off and the prefix fm/", () => {
    expect(parse("- widgets - Legacy (added 2026-01-02)")).toMatchObject({ name: "widgets", registeredMode: "no-mistakes", mode: "no-mistakes", yolo: false, branchPrefix: "fm/", forge: "none", flags: [], notes: [] });
  });

  it("[U1024] maps no-mistakes-prod-only to no-mistakes and says so", () => {
    const entry = parse("- prod gadgets [no-mistakes-prod-only] - Conditional (added 2026-06-07)");
    expect(entry).toMatchObject({ name: "prod gadgets", registeredMode: "no-mistakes-prod-only", mode: "no-mistakes" });
    expect(entry?.notes.join(" ")).toMatch(/most rigorous/);
  });

  it("[U1025] reads an empty branch= as an empty prefix and not as fm/", () => {
    expect(parse("- a [no-mistakes branch=] - d")?.branchPrefix).toBe("");
  });

  it("[U1026] flags an unknown mode or token, does not guess, and skips lines that are not registry lines", () => {
    const unknownMode = parse("- mystery [wibble] - Unknown (added 2026-07-08)");
    expect(unknownMode).toMatchObject({ registeredMode: "wibble", mode: null });
    expect(unknownMode?.flags.join(" ")).toMatch(/unknown mode `wibble`/);
    const extra = parse("- oddity [direct-PR extra] - d");
    expect(extra?.flags.join(" ")).toMatch(/unexpected token `extra`/);
    const all = parseRegistry(REGISTRY);
    expect(all.entries.map((entry) => entry.name)).toEqual(["widgets", "gadgets", "gizmos", "doodads", "thingamajigs", "prod gadgets", "mystery", "oddity"]);
    expect(all.skipped).toBe(2);
  });

  it("[U1027] lets a name contain spaces and ends it at the first ` [` or ` - `", () => {
    expect(parse("- my big project [no-mistakes] - d")?.name).toBe("my big project");
    expect(parse("- my big project - desc [not a bracket]")?.name).toBe("my big project");
    expect(parse("- name with - dash [direct-PR] - d")).toMatchObject({ name: "name with", registeredMode: "no-mistakes" });
  });

  it("reads the gerrit forge and says that the merge path cannot use it", () => {
    const entry = parse("- a [no-mistakes forge=gerrit] - d");
    expect(entry?.forge).toBe("gerrit");
    expect(entry?.notes.join(" ")).toMatch(/gerrit/);
  });
});
