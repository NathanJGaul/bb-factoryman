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

  it("[U1050] reports a line with an unclosed bracket as an entry with a flag, and does not skip it", () => {
    const entry = parse("- broken [no-mistakes - Never closed (added 2026-01-01)");
    expect(entry).toMatchObject({ name: "broken", mode: null });
    expect(entry?.flags.join(" ")).toMatch(/bracket/);
    expect(parseRegistry("- broken [no-mistakes - Never closed").skipped).toBe(0);
  });

  it("[U1051] reads a bare yolo as an unknown mode and not as the approval bypass", () => {
    const entry = parse("- a [yolo] - d");
    expect(entry).toMatchObject({ mode: null, yolo: false, registeredMode: "yolo" });
    expect(entry?.flags.join(" ")).toMatch(/unknown mode `yolo`/);
    const withMode = parse("- a [direct-PR yolo] - d");
    expect(withMode).toMatchObject({ mode: "direct-PR", yolo: false });
    expect(withMode?.flags.join(" ")).toMatch(/unexpected token `yolo`/);
  });

  it("[U1052] reads an empty forge= as none, and flags a token that follows the mode", () => {
    expect(parse("- a [no-mistakes forge=] - d")?.forge).toBe("none");
    expect(parse("- a [local-only odd +yolo] - d")).toMatchObject({ mode: "local-only", yolo: true });
    expect(parse("- a [local-only odd] - d")?.flags.join(" ")).toMatch(/unexpected token `odd`/);
  });

  it("[U1053] skips a line that is only a dash and a word, with no separator after the name", () => {
    expect(parseRegistry("-x - y").skipped).toBe(1);
    expect(parseRegistry("- justaname").skipped).toBe(1);
  });
});
