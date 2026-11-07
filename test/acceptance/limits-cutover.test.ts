import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { REGISTRY } from "../fixtures/registry";
import { loadWorld, type World } from "../fixtures/plugin-host";

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function registryFile(text = REGISTRY): string {
  const dir = mkdtempSync(join(tmpdir(), "factoryman-registry-"));
  dirs.push(dir);
  const path = join(dir, "projects.md");
  writeFileSync(path, text);
  return path;
}

async function cli(world: World, argv: string[]): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const result = await world.host.harness.behavior.runCli(argv);
  return { exitCode: result.exitCode, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

const projects = [
  { id: "proj-gadgets", name: "gadgets" },
  { id: "proj-gizmos", name: "Gizmos" },
];

describe("bb factoryman protection", () => {
  it("[A1017] prints the checklist and the gh api commands, runs nothing, and says it changed nothing", async () => {
    const world = await loadWorld();
    const result = await cli(world, ["protection", "acme/widgets", "--branch", "trunk", "--check", "ci/no-mistakes"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("gh api --method PUT repos/acme/widgets/branches/trunk/protection");
    expect(result.stdout).toContain('"contexts": ["ci/no-mistakes"]');
    expect(result.stdout).toMatch(/ran nothing and changed no setting/);
    expect(world.execCalls).toEqual([]);
    const defaults = await cli(world, ["protection", "acme/widgets"]);
    expect(defaults.stdout).toContain("branches/main/protection");
    expect(defaults.stdout).toContain('"contexts": ["no-mistakes"]');
    for (const argv of [["protection"], ["protection", "acme"], ["protection", "acme/widgets", "--bogus", "x"], ["protection", "acme/widgets", "--branch"]]) {
      const bad = await cli(world, argv);
      expect(bad.exitCode, argv.join(" ")).toBe(2);
      expect(bad.stderr).toContain("Usage: bb factoryman protection");
    }
  });

  it("[A1018] has a setup document that names the required check, scoped tokens, the verification, and the approval form gap", () => {
    const text = readFileSync(new URL("../../docs/BRANCH-PROTECTION.md", import.meta.url), "utf8");
    for (const needle of ["no-mistakes", "scoped", "Administration", "not proof of a human", "gh api", "git push origin HEAD:main", "changes no GitHub setting"]) {
      expect(text, needle).toContain(needle);
    }
    const cutover = readFileSync(new URL("../../docs/CUTOVER.md", import.meta.url), "utf8");
    expect(cutover).toContain("import-registry");
    expect(cutover).toMatch(/one at a time/);
  });
});

describe("bb factoryman import-registry", () => {
  it("[A1019] reports the mode, yolo, prefix, and forge of every project, and matches bb projects by name", async () => {
    const world = await loadWorld({ projectList: projects });
    const result = await cli(world, ["import-registry", "--file", registryFile()]);
    expect(result.exitCode).toBe(0);
    const line = (name: string) => result.stdout.split("\n").find((entry) => entry.startsWith(`${name} |`)) ?? "";
    expect(line("gadgets")).toBe("gadgets | no-mistakes | no-mistakes | off | fm/ | none | proj-gadgets");
    expect(line("gizmos")).toBe("gizmos | direct-PR | direct-PR | on | fm/ | none | proj-gizmos");
    expect(line("doodads")).toBe("doodads | local-only | local-only | off | wip/ | none | not found in bb");
    expect(line("thingamajigs")).toBe("thingamajigs | no-mistakes | no-mistakes | on |  | gerrit | not found in bb");
    expect(result.stdout).toContain("8 projects");
    expect(result.stdout).toContain("Dry run: nothing was written.");
  });

  it("[A1020] maps a line with no bracket and a no-mistakes-prod-only line to no-mistakes, with a note for the second", async () => {
    const world = await loadWorld();
    const result = await cli(world, ["import-registry", "--file", registryFile()]);
    const line = (name: string) => result.stdout.split("\n").find((entry) => entry.startsWith(`${name} |`)) ?? "";
    expect(line("widgets")).toMatch(/^widgets \| no-mistakes \| no-mistakes \| off \| fm\/ \| none/);
    expect(line("prod gadgets")).toMatch(/^prod gadgets \| no-mistakes-prod-only \| no-mistakes \|/);
    expect(result.stdout).toMatch(/prod gadgets.*most rigorous/);
  });

  it("[A1021] flags an unknown mode or token and does not guess", async () => {
    const world = await loadWorld();
    const result = await cli(world, ["import-registry", "--file", registryFile()]);
    expect(result.stdout).toMatch(/mystery.*unknown mode `wibble`/);
    expect(result.stdout).toMatch(/oddity.*unexpected token `extra`/);
    const line = (name: string) => result.stdout.split("\n").find((entry) => entry.startsWith(`${name} |`)) ?? "";
    expect(line("mystery")).toMatch(/^mystery \| wibble \| unknown \|/);
  });

  it("[A1022] changes no project config and only reads the registry file", async () => {
    const world = await loadWorld({ projectList: projects });
    world.setProject({ yolo: false, branchPrefix: null });
    const before = JSON.stringify(["proj-1", "proj-gadgets", "proj-gizmos"].map((id) => world.store.getProjectConfig(id)));
    const path = registryFile();
    const stat = statSync(path);
    const events = world.store.listEvents().length;
    await cli(world, ["import-registry", "--file", path]);
    expect(JSON.stringify(["proj-1", "proj-gadgets", "proj-gizmos"].map((id) => world.store.getProjectConfig(id)))).toBe(before);
    expect(world.store.listEvents()).toHaveLength(events);
    expect(statSync(path).mtimeMs).toBe(stat.mtimeMs);
    expect(readFileSync(path, "utf8")).toBe(REGISTRY);
    expect(world.execCalls).toEqual([]);
  });

  it("[A1023] refuses --apply and says that only the dry run exists", async () => {
    const world = await loadWorld();
    const result = await cli(world, ["import-registry", "--file", registryFile(), "--apply"]);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toMatch(/dry run/);
    expect(result.stdout).not.toContain("gadgets |");
  });

  it("prints usage without a file, and an error for a file that cannot be read", async () => {
    const world = await loadWorld();
    const none = await cli(world, ["import-registry"]);
    expect(none.exitCode).toBe(2);
    expect(none.stderr).toContain("Usage: bb factoryman import-registry --file <path>");
    const missing = await cli(world, ["import-registry", "--file", "/nonexistent/projects.md"]);
    expect(missing.exitCode).toBe(1);
    expect(missing.stderr).toMatch(/could not read/);
  });
});
