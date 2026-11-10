import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadWorld, type World } from "../fixtures/plugin-host";

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function registryFile(text: string): string {
  const dir = mkdtempSync(join(tmpdir(), "factoryman-registry-apply-"));
  dirs.push(dir);
  const path = join(dir, "projects.md");
  writeFileSync(path, text);
  return path;
}

async function cli(world: World, argv: string[]): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const result = await world.host.harness.behavior.runCli(argv);
  return { exitCode: result.exitCode, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

const TABLES = ["project_config", "task", "task_event", "approval"];
const dump = (world: World, tables: string[] = TABLES) => JSON.stringify(tables.map((name) => world.host.bb.storage.database().prepare(`select * from ${name} order by 1, 2`).all()));
const configOf = (world: World, id: string) => world.store.getProjectConfig(id);

const LINES = [
  "# Registered projects",
  "",
  "- widgets - Legacy line with no bracket (added 2026-01-02)",
  "- gizmos [direct-PR branch=wip/] - Direct pull requests (added 2026-03-04)",
  "- yolos [direct-PR +yolo] - Yolo on (added 2026-03-05)",
  "- bare [direct-PR yolo] - Bare token (added 2026-03-06)",
  "- thingamajigs [+yolo no-mistakes branch= forge=gerrit] - Empty prefix, gerrit (added 2026-05-06)",
  "- prod gadgets [no-mistakes-prod-only] - Conditional policy (added 2026-06-07)",
  "- mystery [wibble] - Unknown mode (added 2026-07-08)",
  "- oddity [direct-PR extra] - Unknown token (added 2026-08-09)",
  "- unclosed [direct-PR - Never closed (added 2026-08-10)",
  "- gadgets [local-only] - Shorter name inside another (added 2026-08-10)",
  "- twin [local-only] - One (added 2026-08-11)",
  "- twin [direct-PR] - Two (added 2026-08-12)",
  "- ghost [direct-PR] - Not in bb (added 2026-08-13)",
  "not a registry line",
].join("\n");

const PROJECTS = [
  { id: "proj-widgets", name: "widgets" },
  { id: "proj-gizmos", name: "Gizmos" },
  { id: "proj-yolos", name: "yolos" },
  { id: "proj-bare", name: "bare" },
  { id: "proj-thing", name: "thingamajigs" },
  { id: "proj-prod", name: "prod gadgets" },
  { id: "proj-gadgets", name: "gadgets" },
  { id: "proj-mystery", name: "mystery" },
  { id: "proj-oddity", name: "oddity" },
  { id: "proj-unclosed", name: "unclosed" },
  { id: "proj-twin", name: "twin" },
  { id: "proj-twin-2", name: "TWIN" },
];

const apply = (world: World, name: string, file = registryFile(LINES)) => cli(world, ["import-registry", "--file", file, "--apply", "--project", name]);

describe("bb factoryman import-registry --apply through the plugin", () => {
  it("[A1901] stores the mode, yolo, and prefix of the named project and lists what it wrote", async () => {
    const world = await loadWorld({ projectList: PROJECTS });
    const result = await apply(world, "gizmos");
    expect(result.exitCode).toBe(0);
    expect(configOf(world, "proj-gizmos")).toEqual({ projectId: "proj-gizmos", deliveryMode: "direct-PR", yolo: false, branchPrefix: "wip/", baseBranch: null, defaultMachine: null });
    expect(result.stdout).toContain('Applied registry line "gizmos" to bb project proj-gizmos.');
    expect(result.stdout).toContain("  deliveryMode: no-mistakes -> direct-PR");
    expect(result.stdout).toContain("  branchPrefix: (none) -> wip/");
    expect(result.stdout).toContain("unchanged:\n  yolo: off");
  });

  it("[A1902] stores yolo on for +yolo, and refuses a bare yolo token without writing", async () => {
    const world = await loadWorld({ projectList: PROJECTS });
    const on = await apply(world, "yolos");
    expect(on.exitCode).toBe(0);
    expect(on.stdout).toContain("yolo: off -> on");
    expect(configOf(world, "proj-yolos").yolo).toBe(true);
    const before = dump(world);
    const bare = await apply(world, "bare");
    expect(bare.exitCode).toBe(1);
    expect(bare.stderr).toContain("flagged");
    expect(bare.stderr).toContain("unexpected token `yolo`");
    expect(configOf(world, "proj-bare").yolo).toBe(false);
    expect(dump(world)).toBe(before);
  });

  it("[A1903] maps the conditional policy to no-mistakes and prints its note", async () => {
    const world = await loadWorld({ projectList: PROJECTS });
    world.store.putProjectConfig({ ...configOf(world, "proj-prod"), deliveryMode: "local-only" });
    const prod = await apply(world, "prod gadgets");
    expect(prod.exitCode).toBe(0);
    expect(configOf(world, "proj-prod")).toMatchObject({ deliveryMode: "no-mistakes", yolo: false, branchPrefix: "fm/" });
    expect(prod.stdout).toMatch(/- prod gadgets: a conditional policy in firstmate; it maps to no-mistakes, the most rigorous leg/);
  });

  it("[A1903] reads a line with no bracket as no-mistakes with yolo off", async () => {
    const world = await loadWorld({ projectList: PROJECTS });
    world.store.putProjectConfig({ ...configOf(world, "proj-widgets"), deliveryMode: "local-only", yolo: true });
    const plain = await apply(world, "widgets");
    expect(plain.exitCode).toBe(0);
    expect(configOf(world, "proj-widgets")).toMatchObject({ deliveryMode: "no-mistakes", yolo: false, branchPrefix: "fm/" });
  });

  it("[A1903] stores an empty prefix as none, and says the forge is not stored", async () => {
    const world = await loadWorld({ projectList: PROJECTS });
    const gerrit = await apply(world, "thingamajigs");
    expect(gerrit.exitCode).toBe(0);
    expect(configOf(world, "proj-thing")).toMatchObject({ deliveryMode: "no-mistakes", yolo: true, branchPrefix: null });
    expect(gerrit.stdout).toContain("forge gerrit");
    expect(gerrit.stdout).toContain("Forge gerrit is not stored.");
  });

  it("[A1904] leaves a stored base branch and default machine as they are, and lists them as unchanged", async () => {
    const world = await loadWorld({ projectList: PROJECTS });
    world.store.putProjectConfig({ ...configOf(world, "proj-gizmos"), baseBranch: "trunk", defaultMachine: "box-1" });
    const result = await apply(world, "gizmos");
    expect(result.exitCode).toBe(0);
    expect(configOf(world, "proj-gizmos")).toMatchObject({ deliveryMode: "direct-PR", branchPrefix: "wip/", baseBranch: "trunk", defaultMachine: "box-1" });
    expect(result.stdout).toContain("  baseBranch: trunk (not in the registry)");
    expect(result.stdout).toContain("  defaultMachine: box-1 (not in the registry)");
    expect(result.stdout.split("unchanged:")[0]).not.toContain("baseBranch");
  });

  it("[A1905] writes nothing on a rerun, leaves every table identical, and prints every field as unchanged", async () => {
    const world = await loadWorld({ projectList: PROJECTS });
    const file = registryFile(LINES);
    await apply(world, "gizmos", file);
    const after = dump(world);
    const again = await apply(world, "gizmos", file);
    expect(again.exitCode).toBe(0);
    expect(dump(world)).toBe(after);
    expect(again.stdout).toContain("Nothing was written.");
    expect(again.stdout).not.toContain("written:");
    expect(again.stdout).toContain("unchanged:\n  deliveryMode: direct-PR\n  yolo: off\n  branchPrefix: wip/");
    expect(await apply(world, "gizmos", file)).toEqual(again);
  });

  it("[A1905] changes only the field that differs", async () => {
    const world = await loadWorld({ projectList: PROJECTS });
    const file = registryFile(LINES);
    await apply(world, "gizmos", file);
    world.store.putProjectConfig({ ...configOf(world, "proj-gizmos"), branchPrefix: "old/" });
    const one = await apply(world, "gizmos", file);
    expect(one.stdout).toContain("written:\n  branchPrefix: old/ -> wip/\nunchanged:\n  deliveryMode: direct-PR\n  yolo: off");
    expect(configOf(world, "proj-gizmos")).toMatchObject({ deliveryMode: "direct-PR", yolo: false, branchPrefix: "wip/" });
  });

  it("[A1905] turns a stored yolo off when the line does not carry +yolo", async () => {
    const world = await loadWorld({ projectList: PROJECTS });
    world.store.putProjectConfig({ ...configOf(world, "proj-gizmos"), deliveryMode: "direct-PR", branchPrefix: "wip/", yolo: true });
    const off = await apply(world, "gizmos");
    expect(off.stdout).toContain("yolo: on -> off");
    expect(configOf(world, "proj-gizmos").yolo).toBe(false);
  });

  it.each([
    ["no registry line for the name", "nothing", /no project named nothing/],
    ["two registry lines", "twin", /2 lines named twin/],
    ["an unknown mode", "mystery", /flagged.*unknown mode `wibble`/],
    ["an unexpected token", "oddity", /flagged.*unexpected token `extra`/],
    ["an unclosed bracket", "unclosed", /flagged.*never closed/],
    ["a registry line bb does not know", "ghost", /bb has no project named ghost/],
  ])("[A1906] refuses %s and leaves every table identical", async (_label, name, reason) => {
    const world = await loadWorld({ projectList: PROJECTS });
    const before = dump(world);
    const result = await apply(world, name);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toMatch(reason);
    expect(result.stdout).toBe("");
    expect(dump(world)).toBe(before);
  });

  it("[A1906] refuses two bb projects with the name, a bb list failure, and a missing file", async () => {
    const world = await loadWorld({ projectList: PROJECTS });
    const before = dump(world);
    const lines = registryFile("- twin [local-only] - One (added 2026-08-11)");
    const twice = await apply(world, "twin", lines);
    expect(twice.exitCode).toBe(1);
    expect(twice.stderr).toContain("2 projects named twin");

    const down = await loadWorld({ projectList: PROJECTS, projectListError: new Error("bb is down") });
    const downBefore = dump(down);
    const failed = await apply(down, "gizmos");
    expect(failed.exitCode).toBe(1);
    expect(failed.stderr).toContain("could not be listed");
    expect(dump(down)).toBe(downBefore);

    const missing = await cli(world, ["import-registry", "--file", "/nonexistent/projects.md", "--apply", "--project", "gizmos"]);
    expect(missing.exitCode).toBe(1);
    expect(missing.stderr).toMatch(/could not read/i);
    expect(dump(world)).toBe(before);
  });

  it("[A1907] writes only the named project when the file holds many", async () => {
    const world = await loadWorld({ projectList: PROJECTS });
    const rows = (ids: string[]) => ids.map((id) => JSON.stringify(configOf(world, id)));
    const others = PROJECTS.map((project) => project.id).filter((id) => id !== "proj-gizmos");
    const before = rows(others);
    await apply(world, "gizmos");
    expect(rows(others)).toEqual(before);
    expect(world.host.bb.storage.database().prepare("select count(*) as n from project_config").get()).toEqual({ n: 1 });
  });

  it("[A1907] matches the whole name: a name inside a longer one writes the exact project only, and finds nothing when only the longer one exists", async () => {
    const world = await loadWorld({ projectList: PROJECTS });
    const prodBefore = JSON.stringify(configOf(world, "proj-prod"));
    expect((await apply(world, "gadgets")).exitCode).toBe(0);
    expect(configOf(world, "proj-gadgets")).toMatchObject({ deliveryMode: "local-only" });
    expect(JSON.stringify(configOf(world, "proj-prod"))).toBe(prodBefore);

    const onlyLonger = await loadWorld({ projectList: PROJECTS.filter((project) => project.id !== "proj-gadgets") });
    const before = dump(onlyLonger);
    const refused = await apply(onlyLonger, "gadgets");
    expect(refused.exitCode).toBe(1);
    expect(refused.stderr).toContain("bb has no project named gadgets");
    expect(dump(onlyLonger)).toBe(before);
  });

  it("[A1907] refuses --apply without --project and --project without --apply, before it reads anything", async () => {
    const world = await loadWorld({ projectList: PROJECTS });
    const file = registryFile(LINES);
    const before = dump(world);
    for (const argv of [["import-registry", "--file", file, "--apply"], ["import-registry", "--file", file, "--project", "gizmos"]]) {
      const result = await cli(world, argv);
      expect(result.exitCode, argv.join(" ")).toBe(2);
      expect(result.stderr).toContain("Usage: bb factoryman import-registry --file <path> --apply --project <name>");
    }
    expect(dump(world)).toBe(before);
  });

  it("[A1908] changes one project_config row and nothing else, and leaves the registry file and the machine alone", async () => {
    const world = await loadWorld({ projectList: PROJECTS });
    const path = registryFile(LINES);
    const stat = statSync(path);
    const beforeOthers = dump(world, ["task", "task_event", "approval"]);
    const beforeConfig = dump(world, ["project_config"]);
    const sdkBefore = world.host.harness.sdk.calls.length;
    const result = await apply(world, "gizmos", path);
    expect(result.exitCode).toBe(0);
    expect(world.host.harness.sdk.calls.slice(sdkBefore).map((call) => call.path)).toEqual(["projects.list"]);
    expect(dump(world, ["task", "task_event", "approval"])).toBe(beforeOthers);
    expect(dump(world, ["project_config"])).not.toBe(beforeConfig);
    expect(world.host.bb.storage.database().prepare("select count(*) as n from project_config").get()).toEqual({ n: 1 });
    expect(statSync(path).mtimeMs).toBe(stat.mtimeMs);
    expect(readFileSync(path, "utf8")).toBe(LINES);
    expect(world.execCalls).toEqual([]);
    expect(world.sdkCalls("threads.spawn")).toEqual([]);
  });

  it("[A1909] leaves the mode of a task created before the apply, and gives a task created after it the new mode", async () => {
    const world = await loadWorld({ projectList: [{ id: "proj-1", name: "gizmos" }] });
    const task = { kind: "ship", description: "Add a --json flag to the status command." };
    expect((await world.call("factoryman_dispatch", task)).isError).toBe(false);
    const [first] = world.store.listTasks();
    expect(first?.mode).toBe("no-mistakes");
    const result = await apply(world, "gizmos", registryFile("- gizmos [direct-PR] - Direct (added 2026-03-04)"));
    expect(result.exitCode).toBe(0);
    expect(world.store.getTask(first?.taskId ?? "")?.mode).toBe("no-mistakes");
    expect((await world.call("factoryman_dispatch", task)).isError).toBe(false);
    const modes = world.store.listTasks().map((row) => row.mode).sort();
    expect(modes).toEqual(["direct-PR", "no-mistakes"]);
  });
});
