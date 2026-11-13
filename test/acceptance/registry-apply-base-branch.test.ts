import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runCommand } from "../../src/exec";
import { createMergeExecutor } from "../../src/git/merge";
import { worktreeReport } from "../../src/git/report";
import type { TaskRow } from "../../src/store/types";
import { commitFile, git, initRepo } from "../fixtures/git-repo";
import { loadWorld, type World } from "../fixtures/plugin-host";

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function registryFile(text: string): string {
  const dir = mkdtempSync(join(tmpdir(), "factoryman-apply-base-"));
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

const LINES = [
  "- local [local-only] - Local clone (added 2026-03-04)",
  "- remote [direct-PR] - Pull requests (added 2026-03-05)",
  "- mystery [wibble] - Unknown mode (added 2026-03-06)",
].join("\n");
const PROJECTS = [
  { id: "proj-local", name: "local" },
  { id: "proj-remote", name: "remote" },
  { id: "proj-mystery", name: "mystery" },
];
const WARNING = "Warning: this project is local-only and has no base branch, so merge and teardown refuse until you run this command again with --base-branch <name>.";
const NEEDS = "needs a base branch";

const apply = (world: World, name: string, ...rest: string[]) => cli(world, ["import-registry", "--file", registryFile(LINES), "--apply", "--project", name, ...rest]);

describe("bb factoryman import-registry --apply --base-branch through the plugin", () => {
  it("[A1501] stores the base branch of a local-only project and lists it as written", async () => {
    const world = await loadWorld({ projectList: PROJECTS });
    const result = await apply(world, "local", "--base-branch", "main");
    expect(result.exitCode).toBe(0);
    expect(world.store.getProjectConfig("proj-local")).toEqual({ projectId: "proj-local", deliveryMode: "local-only", yolo: false, branchPrefix: "fm/", baseBranch: "main", defaultMachine: null });
    expect(result.stdout).toContain("  baseBranch: (none) -> main");
  });

  it("[A1501] replaces a stored base branch and shows both values, and stores it for a direct-PR project too", async () => {
    const world = await loadWorld({ projectList: PROJECTS });
    world.store.putProjectConfig({ ...world.store.getProjectConfig("proj-local"), baseBranch: "develop" });
    const replaced = await apply(world, "local", "--base-branch", "main");
    expect(replaced.stdout).toContain("  baseBranch: develop -> main");
    expect(world.store.getProjectConfig("proj-local").baseBranch).toBe("main");
    const remote = await apply(world, "remote", "--base-branch", "release/1.0");
    expect(remote.exitCode).toBe(0);
    expect(world.store.getProjectConfig("proj-remote")).toMatchObject({ deliveryMode: "direct-PR", baseBranch: "release/1.0" });
  });

  it("[A1502] a local-only project applied without the flag cannot pass the landed-work check or the merge preflight, and with the flag it can", async () => {
    const repo = initRepo();
    git(repo, "checkout", "-q", "-b", "fm/k1");
    commitFile(repo, "a.txt", "a\n", "work");
    const task: TaskRow = { taskId: "k1", projectId: "proj-local", kind: "ship", mode: "local-only", state: "awaiting_approval", workerThreadId: "thr-w1", branch: "fm/k1", machine: null, pullRequestUrl: null };
    const consumers = async (world: World) => {
      const config = world.store.getProjectConfig("proj-local");
      git(repo, "checkout", "-q", "fm/k1");
      const report = await worktreeReport(runCommand, { path: repo, mode: "local-only", baseBranch: config.baseBranch });
      git(repo, "checkout", "-q", "main");
      const preflight = await createMergeExecutor(runCommand).preflight({ task, config, checkoutPath: repo, remoteUrl: null, method: "merge" });
      return { report, preflight };
    };

    const without = await loadWorld({ projectList: PROJECTS });
    await apply(without, "local");
    const before = await consumers(without);
    expect(before.report).toEqual({ ok: false, message: expect.stringContaining(NEEDS) });
    expect(before.preflight).toContain(NEEDS);

    const withFlag = await loadWorld({ projectList: PROJECTS });
    await apply(withFlag, "local", "--base-branch", "main");
    const after = await consumers(withFlag);
    expect(after.report).toEqual({ ok: true, report: { uncommittedChanges: false, unpushedCommits: 1 } });
    expect(after.preflight).toBeNull();
  });

  it("[A1503] without the flag the base branch stays as stored, and a local-only project says what is missing", async () => {
    const world = await loadWorld({ projectList: PROJECTS });
    const first = await apply(world, "local");
    expect(first.stdout).toContain("  baseBranch: (none) (not in the registry)");
    expect(first.stdout).toContain(WARNING);
    expect(world.store.getProjectConfig("proj-local").baseBranch).toBeNull();
    const rerun = await apply(world, "local");
    expect(rerun.stdout).toContain("Nothing was written.");
    expect(rerun.stdout).toContain(WARNING);
  });

  it("[A1503] prints no warning for direct-PR with no base branch, for a stored base branch, or after the flag", async () => {
    const world = await loadWorld({ projectList: PROJECTS });
    expect((await apply(world, "remote")).stdout).not.toContain("Warning:");
    world.store.putProjectConfig({ ...world.store.getProjectConfig("proj-local"), baseBranch: "trunk" });
    const stored = await apply(world, "local");
    expect(stored.stdout).toContain("  baseBranch: trunk (not in the registry)");
    expect(stored.stdout).not.toContain("Warning:");
    const flagged = await loadWorld({ projectList: PROJECTS });
    expect((await apply(flagged, "local", "--base-branch", "main")).stdout).not.toContain("Warning:");
  });

  it.each([
    ["--base-branch without --apply", (file: string) => ["import-registry", "--file", file, "--project", "local", "--base-branch", "main"], 2],
    ["--base-branch with no value", (file: string) => ["import-registry", "--file", file, "--apply", "--project", "local", "--base-branch"], 2],
    ["--base-branch with a flag as its value", (file: string) => ["import-registry", "--file", file, "--apply", "--project", "local", "--base-branch", "--apply"], 2],
    ["--base-branch twice", (file: string) => ["import-registry", "--file", file, "--apply", "--project", "local", "--base-branch", "main", "--base-branch", "dev"], 2],
    ["an invalid name", (file: string) => ["import-registry", "--file", file, "--apply", "--project", "local", "--base-branch", "-x"], 2],
    ["a name with a space", (file: string) => ["import-registry", "--file", file, "--apply", "--project", "local", "--base-branch", "a b"], 2],
    ["--base-branch with neither --apply nor --project", (file: string) => ["import-registry", "--file", file, "--base-branch", "main"], 2],
    ["a name with a leading space", (file: string) => ["import-registry", "--file", file, "--apply", "--project", "local", "--base-branch", " main"], 2],
    ["a name with a trailing space", (file: string) => ["import-registry", "--file", file, "--apply", "--project", "local", "--base-branch", "main "], 2],
    ["no registry line", (file: string) => ["import-registry", "--file", file, "--apply", "--project", "nothing", "--base-branch", "main"], 1],
    ["a flagged line", (file: string) => ["import-registry", "--file", file, "--apply", "--project", "mystery", "--base-branch", "main"], 1],
    ["an unknown bb project", (file: string) => ["import-registry", "--file", file, "--apply", "--project", "remote", "--base-branch", "main"], 1],
  ])("[A1504] %s leaves every table identical", async (label, argv, code) => {
    const world = await loadWorld({ projectList: label === "an unknown bb project" ? [{ id: "x", name: "other" }] : PROJECTS });
    const before = dump(world);
    const result = await cli(world, argv(registryFile(LINES)));
    expect(result.exitCode).toBe(code);
    expect(dump(world)).toBe(before);
  });

  it("[A1504] refuses with the same exit code when bb cannot list its projects", async () => {
    const world = await loadWorld({ projectList: PROJECTS, projectListError: new Error("bb is down") });
    const before = dump(world);
    const result = await apply(world, "local", "--base-branch", "main");
    expect(result.exitCode).toBe(1);
    expect(dump(world)).toBe(before);
  });

  it("[A1505] a first apply changes one project_config row only, and a rerun with the same flag changes nothing", async () => {
    const world = await loadWorld({ projectList: PROJECTS });
    const others = (w: World) => dump(w, ["task", "task_event", "approval"]);
    const beforeOthers = others(world);
    const first = await apply(world, "local", "--base-branch", "main");
    expect(first.exitCode).toBe(0);
    expect(others(world)).toBe(beforeOthers);
    expect(JSON.parse(dump(world, ["project_config"]))[0]).toHaveLength(1);
    const afterFirst = dump(world);
    const rerun = await apply(world, "local", "--base-branch", "main");
    expect(rerun.exitCode).toBe(0);
    expect(rerun.stdout).toContain("Nothing was written.");
    expect(rerun.stdout).toContain("unchanged:");
    expect(rerun.stdout).toContain("  baseBranch: main");
    expect(rerun.stdout).not.toContain("written:");
    expect(dump(world)).toBe(afterFirst);
  });
});
