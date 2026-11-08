import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { commitFile, git, initRepo, repoWithRemote, tmpDir } from "../../test/fixtures/git-repo";
import { runCommand, type Exec } from "../exec";
import { worktreeReport } from "./report";

const prMode = (path: string) => ({ path, mode: "no-mistakes" as const, baseBranch: null });

describe("worktreeReport", () => {
  it("[U69] reports a clean worktree with no uncommitted changes and no unpushed commits", async () => {
    const { repo } = repoWithRemote();
    expect(await worktreeReport(runCommand, prMode(repo))).toEqual({ ok: true, report: { uncommittedChanges: false, unpushedCommits: 0 } });
  });

  it("[U70] reports a modified tracked file as an uncommitted change", async () => {
    const { repo } = repoWithRemote();
    writeFileSync(join(repo, "README.md"), "changed\n");
    const result = await worktreeReport(runCommand, prMode(repo));
    expect(result.ok && result.report.uncommittedChanges).toBe(true);
  });

  it("[U71] reports an untracked file as an uncommitted change", async () => {
    const { repo } = repoWithRemote();
    writeFileSync(join(repo, "new.txt"), "new\n");
    const result = await worktreeReport(runCommand, prMode(repo));
    expect(result.ok && result.report.uncommittedChanges).toBe(true);
  });

  it("[U72] counts a commit that is on no remote ref as unpushed in a pull request mode", async () => {
    const { repo } = repoWithRemote();
    commitFile(repo, "a.txt", "a\n", "local only");
    const result = await worktreeReport(runCommand, prMode(repo));
    expect(result).toEqual({ ok: true, report: { uncommittedChanges: false, unpushedCommits: 1 } });
  });

  it("[U73] counts a pushed commit as landed in a pull request mode", async () => {
    const { repo } = repoWithRemote();
    git(repo, "checkout", "-q", "-b", "fm/k1");
    commitFile(repo, "a.txt", "a\n", "work");
    git(repo, "push", "-q", "origin", "fm/k1");
    const result = await worktreeReport(runCommand, { path: repo, mode: "direct-PR", baseBranch: null });
    expect(result).toEqual({ ok: true, report: { uncommittedChanges: false, unpushedCommits: 0 } });
  });

  it("[U74] counts every commit as unpushed when the repository has no remote", async () => {
    const repo = initRepo();
    commitFile(repo, "a.txt", "a\n", "second");
    const result = await worktreeReport(runCommand, prMode(repo));
    expect(result.ok && result.report.unpushedCommits).toBe(2);
  });

  it("[U75] counts local-only commits that the base branch lacks, and none once they are merged", async () => {
    const repo = initRepo();
    git(repo, "checkout", "-q", "-b", "fm/k1");
    commitFile(repo, "a.txt", "a\n", "one");
    commitFile(repo, "b.txt", "b\n", "two");
    const input = { path: repo, mode: "local-only" as const, baseBranch: "main" };
    expect(await worktreeReport(runCommand, input)).toEqual({ ok: true, report: { uncommittedChanges: false, unpushedCommits: 2 } });
    git(repo, "checkout", "-q", "main");
    git(repo, "merge", "-q", "--no-ff", "-m", "merge", "fm/k1");
    git(repo, "checkout", "-q", "fm/k1");
    expect(await worktreeReport(runCommand, input)).toEqual({ ok: true, report: { uncommittedChanges: false, unpushedCommits: 0 } });
  });

  it("[U76] is an error for local-only without a base branch", async () => {
    const repo = initRepo();
    const result = await worktreeReport(runCommand, { path: repo, mode: "local-only", baseBranch: null });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.message).toMatch(/base branch/i);
  });

  it("[U210] refuses a blank or dash-led base branch before running any git command", async () => {
    for (const baseBranch of ["", "   ", "-x", "--all"]) {
      const calls: string[] = [];
      const exec = async (command: string, args: readonly string[]) => {
        calls.push([command, ...args].join(" "));
        return { code: 0, stdout: "0\n", stderr: "" };
      };
      const result = await worktreeReport(exec, { path: "/work/tree", mode: "local-only", baseBranch });
      expect(result.ok, JSON.stringify(baseBranch)).toBe(false);
      expect(calls, JSON.stringify(baseBranch)).toEqual([]);
    }
  });

  it("[U77] is an error and never an empty report when git fails", async () => {
    const result = await worktreeReport(runCommand, prMode(tmpDir()));
    expect(result.ok).toBe(false);
    expect(!result.ok && result.message).toMatch(/git/i);
  });

  it("[U837] passes the host option and the path to each git command", async () => {
    const calls: Array<{ args: readonly string[]; cwd?: string; host?: string | null }> = [];
    const exec: Exec = async (_command, args, options) => {
      calls.push({ args, cwd: options?.cwd, host: options?.host });
      return { code: 0, stdout: args[0] === "rev-list" ? "0\n" : "", stderr: "" };
    };
    await worktreeReport(exec, { ...prMode("/work/gpu/tree"), host: "host_gpu" });
    expect(calls).toHaveLength(2);
    expect(calls.every((call) => call.host === "host_gpu" && call.cwd === "/work/gpu/tree")).toBe(true);
    calls.length = 0;
    await worktreeReport(exec, prMode("/work/tree"));
    expect(calls.every((call) => call.host === null || call.host === undefined)).toBe(true);
  });
});
