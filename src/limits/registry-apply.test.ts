import { describe, expect, it } from "vitest";
import { defaultProjectConfig } from "../store/store";
import type { ProjectConfig } from "../store/types";
import { parseRegistry } from "./registry";
import { checkBranchName, planApply, type ApplyPlan, type ApplyRefusal } from "./registry-apply";

const entries = (...lines: string[]) => parseRegistry(lines.join("\n")).entries;
const stored = (patch: Partial<ProjectConfig> = {}) => (id: string): ProjectConfig => ({ ...defaultProjectConfig(id), ...patch });
const gizmos = [{ id: "proj-gizmos", name: "Gizmos" }];

function planOf(result: ApplyPlan | ApplyRefusal): ApplyPlan {
  if (!result.ok) throw new Error(`expected a plan, got ${result.code}: ${result.message}`);
  return result;
}

function refusalOf(result: ApplyPlan | ApplyRefusal): ApplyRefusal {
  if (result.ok) throw new Error(`expected a refusal, got a plan for ${result.projectId}`);
  return result;
}

describe("planApply", () => {
  it("[U1901] plans the three fields from a clean entry and leaves base branch and default machine as stored", () => {
    const plan = planOf(planApply({ name: "gizmos", entries: entries("- gizmos [direct-PR +yolo branch=wip/] - d"), projects: gizmos, stored: stored({ baseBranch: "main", defaultMachine: "box" }) }));
    expect(plan.projectId).toBe("proj-gizmos");
    expect(plan.changes).toEqual([
      { field: "deliveryMode", from: "no-mistakes", to: "direct-PR", changed: true },
      { field: "yolo", from: false, to: true, changed: true },
      { field: "branchPrefix", from: null, to: "wip/", changed: true },
    ]);
    expect(plan.untouched).toEqual([
      { field: "baseBranch", value: "main" },
      { field: "defaultMachine", value: "box" },
    ]);
    expect(plan.next).toEqual({ projectId: "proj-gizmos", deliveryMode: "direct-PR", yolo: true, branchPrefix: "wip/", baseBranch: "main", defaultMachine: "box" });
  });

  it.each([
    ["an empty prefix", "- gizmos [local-only branch=] - d", { deliveryMode: "local-only", branchPrefix: null }],
    ["no bracket", "- gizmos - d", { deliveryMode: "no-mistakes", branchPrefix: "fm/" }],
    ["the conditional policy", "- gizmos [no-mistakes-prod-only] - d", { deliveryMode: "no-mistakes", branchPrefix: "fm/" }],
  ])("[U1901] maps %s", (_label, line, expected) => {
    const plan = planOf(planApply({ name: "gizmos", entries: entries(line), projects: gizmos, stored: stored({ deliveryMode: "direct-PR", branchPrefix: "old/" }) }));
    const to = Object.fromEntries(plan.changes.map((change) => [change.field, change.to]));
    expect(to).toMatchObject({ ...expected, yolo: false });
  });

  it("[U1901] keeps the entry's notes and names the forge as not stored", () => {
    const plan = planOf(planApply({ name: "gizmos", entries: entries("- gizmos [no-mistakes-prod-only forge=gerrit] - d"), projects: gizmos, stored: stored() }));
    expect(plan.notes.join("\n")).toMatch(/most rigorous/);
    expect(plan.notes.join("\n")).toMatch(/forge gerrit/);
    expect(plan.forge).toBe("gerrit");
  });

  it.each([
    ["no entry", "gizmos", ["- other [direct-PR] - d"], gizmos, "no_entry"],
    ["two entries with the name", "gizmos", ["- gizmos [direct-PR] - d", "- GIZMOS [local-only] - d"], gizmos, "ambiguous_entry"],
    ["an unknown mode", "gizmos", ["- gizmos [wibble] - d"], gizmos, "flagged"],
    ["an unexpected token", "gizmos", ["- gizmos [direct-PR extra] - d"], gizmos, "flagged"],
    ["an unclosed bracket", "gizmos", ["- gizmos [direct-PR - d"], gizmos, "flagged"],
    ["a bare yolo token", "gizmos", ["- gizmos [yolo] - d"], gizmos, "flagged"],
    ["a bare yolo token after a mode", "gizmos", ["- gizmos [direct-PR yolo] - d"], gizmos, "flagged"],
    ["no bb project", "gizmos", ["- gizmos [direct-PR] - d"], [{ id: "p", name: "other" }], "unknown_project"],
    ["a longer registry name that contains the name", "gadgets", ["- prod gadgets [direct-PR] - d"], [{ id: "p", name: "gadgets" }], "no_entry"],
    ["a longer bb project name that contains the name", "gadgets", ["- gadgets [direct-PR] - d"], [{ id: "p", name: "prod gadgets" }], "unknown_project"],
    ["two bb projects with the name", "gizmos", ["- gizmos [direct-PR] - d"], [{ id: "a", name: "gizmos" }, { id: "b", name: "GIZMOS" }], "ambiguous_project"],
  ])("[U1902] refuses %s", (_label, name, lines, projects, code) => {
    const result = refusalOf(planApply({ name, entries: entries(...lines), projects, stored: stored() }));
    expect(result.code).toBe(code);
    expect(result.message).toContain(name);
    expect("next" in result).toBe(false);
  });

  it("[U1902] matches the registry name, the --project name, and the bb project name without regard to letter case", () => {
    const plan = planOf(planApply({ name: "GIZMOS", entries: entries("- Gizmos [direct-PR] - d"), projects: [{ id: "p-1", name: "gIzMoS" }], stored: stored() }));
    expect(plan.projectId).toBe("p-1");
  });

  it("[U1902] picks the exact name when another name contains it, in the registry and in bb", () => {
    const plan = planOf(
      planApply({
        name: "gadgets",
        entries: entries("- prod gadgets [local-only] - d", "- gadgets [direct-PR] - d"),
        projects: [{ id: "p-prod", name: "prod gadgets" }, { id: "p-plain", name: "gadgets" }],
        stored: stored(),
      }),
    );
    expect(plan.projectId).toBe("p-plain");
    expect(plan.next).toMatchObject({ projectId: "p-plain", deliveryMode: "direct-PR" });
  });

  it("[U1902] ignores a flagged line for another project", () => {
    const plan = planOf(planApply({ name: "gizmos", entries: entries("- gizmos [direct-PR] - d", "- mystery [wibble] - d"), projects: gizmos, stored: stored() }));
    expect(plan.projectId).toBe("proj-gizmos");
  });

  it("[U1903] plans no write when every field already equals the target", () => {
    const plan = planOf(planApply({ name: "gizmos", entries: entries("- gizmos [direct-PR +yolo branch=wip/] - d"), projects: gizmos, stored: stored({ deliveryMode: "direct-PR", yolo: true, branchPrefix: "wip/" }) }));
    expect(plan.changes.every((change) => !change.changed)).toBe(true);
    expect(plan.next).toBeNull();
  });

  it.each([
    ["deliveryMode", { deliveryMode: "local-only" as const }],
    ["yolo", { yolo: true }],
    ["branchPrefix", { branchPrefix: "old/" }],
  ])("[U1903] flags only %s when only it differs", (field, patch) => {
    const base = { deliveryMode: "direct-PR" as const, yolo: false, branchPrefix: "wip/", ...patch };
    const plan = planOf(planApply({ name: "gizmos", entries: entries("- gizmos [direct-PR branch=wip/] - d"), projects: gizmos, stored: stored(base) }));
    expect(plan.changes.filter((change) => change.changed).map((change) => change.field)).toEqual([field]);
    expect(plan.next).not.toBeNull();
  });

  it("[U1903] turns a stored yolo off when the entry has none, and keeps base branch and default machine in the row", () => {
    const plan = planOf(planApply({ name: "gizmos", entries: entries("- gizmos [no-mistakes branch=fm/] - d"), projects: gizmos, stored: stored({ yolo: true, branchPrefix: "fm/", baseBranch: "trunk", defaultMachine: "m-1" }) }));
    expect(plan.changes.find((change) => change.field === "yolo")).toEqual({ field: "yolo", from: true, to: false, changed: true });
    expect(plan.next).toMatchObject({ yolo: false, baseBranch: "trunk", defaultMachine: "m-1" });
  });

  it("[U1903] treats a null stored prefix and an empty registry prefix as equal", () => {
    const plan = planOf(planApply({ name: "gizmos", entries: entries("- gizmos [no-mistakes branch=] - d"), projects: gizmos, stored: stored() }));
    expect(plan.next).toBeNull();
  });
});

describe("checkBranchName", () => {
  it.each(["main", "release/1.0", "feature/a_b-c", "v1.2", "Trunk"])("[U1501] accepts %j", (name) => {
    expect(checkBranchName(name)).toBeNull();
  });

  it.each([
    ["", "empty"],
    ["   ", "blank"],
    [" main", "leading space"],
    ["main ", "trailing space"],
    ["-x", "leading dash"],
    ["--x", "leading dashes"],
    ["a b", "space inside"],
    ["a\tb", "tab"],
    ["a\nb", "newline"],
    ["a..b", "double dot"],
    ["a~b", "tilde"],
    ["a^b", "caret"],
    ["a:b", "colon"],
    ["a?b", "question mark"],
    ["a*b", "asterisk"],
    ["a[b", "bracket"],
    ["a\\b", "backslash"],
    ["a@{b", "at brace"],
    ["a//b", "double slash"],
    ["/a", "leading slash"],
    ["a/", "trailing slash"],
    ["a.", "trailing dot"],
    ["a.lock", "lock suffix"],
    ["@", "single at"],
  ])("[U1501] refuses %j (%s) with a reason", (name) => {
    const reason = checkBranchName(name);
    expect(typeof reason).toBe("string");
    expect(reason).not.toBe("");
  });
});

describe("planApply with a base branch", () => {
  const plan = (line: string, baseBranch: string | undefined, patch: Partial<ProjectConfig> = {}) =>
    planOf(planApply({ name: "gizmos", entries: entries(line), projects: gizmos, stored: stored(patch), ...(baseBranch === undefined ? {} : { baseBranch }) }));

  it("[U1502] lists the base branch as a change, drops it from untouched, and puts it in next", () => {
    const result = plan("- gizmos [local-only] - d", "main", { deliveryMode: "local-only", branchPrefix: "fm/" });
    expect(result.changes.find((change) => change.field === "baseBranch")).toEqual({ field: "baseBranch", from: null, to: "main", changed: true });
    expect(result.untouched).toEqual([{ field: "defaultMachine", value: null }]);
    expect(result.next).toMatchObject({ baseBranch: "main" });
  });

  it("[U1502] replaces a stored base branch and flags it changed only when the value differs", () => {
    const line = "- gizmos [local-only] - d";
    const differs = plan(line, "main", { deliveryMode: "local-only", branchPrefix: "fm/", baseBranch: "develop" });
    expect(differs.changes.find((change) => change.field === "baseBranch")).toEqual({ field: "baseBranch", from: "develop", to: "main", changed: true });
    const equal = plan(line, "main", { deliveryMode: "local-only", branchPrefix: "fm/", baseBranch: "main" });
    expect(equal.changes.find((change) => change.field === "baseBranch")).toMatchObject({ changed: false });
    expect(equal.next).toBeNull();
  });

  it.each([
    ["a local-only result with no base branch", "- gizmos [local-only] - d", undefined, {}, true],
    ["a local-only result with a stored base branch", "- gizmos [local-only] - d", undefined, { baseBranch: "main" }, false],
    ["a local-only result with a given base branch", "- gizmos [local-only] - d", "main", {}, false],
    ["a direct-PR result with no base branch", "- gizmos [direct-PR] - d", undefined, {}, false],
    ["a no-mistakes result with no base branch", "- gizmos [no-mistakes] - d", undefined, {}, false],
  ])("[U1503] needsBaseBranch is decided for %s", (_label, line, flag, patch, expected) => {
    expect(plan(line, flag, patch).needsBaseBranch).toBe(expected);
  });

  it("[U1503] without the flag the plan keeps base branch in untouched and out of changes", () => {
    const result = plan("- gizmos [local-only] - d", undefined, { baseBranch: "trunk" });
    expect(result.untouched).toEqual([{ field: "baseBranch", value: "trunk" }, { field: "defaultMachine", value: null }]);
    expect(result.changes.map((change) => change.field)).toEqual(["deliveryMode", "yolo", "branchPrefix"]);
  });
});
