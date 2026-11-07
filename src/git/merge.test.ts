import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { commitFile, git, initRepo } from "../../test/fixtures/git-repo";
import { runCommand, type Exec, type ExecResult } from "../exec";
import { defaultProjectConfig } from "../store/store";
import type { ProjectConfig, TaskRow } from "../store/types";
import { createMergeExecutor, type MergeInput } from "./merge";

const PR = "https://github.com/acme/widgets/pull/7";
const REMOTE = "git@github.com:acme/widgets.git";

function task(overrides: Partial<TaskRow> = {}): TaskRow {
  return {
    taskId: "k1",
    projectId: "proj-1",
    kind: "ship",
    mode: "no-mistakes",
    state: "awaiting_approval",
    workerThreadId: "thr-w1",
    branch: "fm/k1",
    machine: null,
    pullRequestUrl: PR,
    ...overrides,
  };
}

function input(overrides: Omit<Partial<MergeInput>, "config"> & { config?: Partial<ProjectConfig> } = {}): MergeInput {
  const { config, ...rest } = overrides;
  return { task: task(), config: { ...defaultProjectConfig("proj-1"), ...config }, checkoutPath: null, remoteUrl: REMOTE, method: "squash", ...rest };
}

function recordingExec(result: Partial<ExecResult> = {}) {
  const calls: Array<{ command: string; args: readonly string[]; cwd?: string }> = [];
  const exec: Exec = async (command, args, options) => {
    calls.push({ command, args, cwd: options?.cwd });
    return { code: 0, stdout: "", stderr: "", ...result };
  };
  return { exec, calls };
}

beforeEach(() => {
  vi.stubEnv("GIT_AUTHOR_NAME", "Test");
  vi.stubEnv("GIT_AUTHOR_EMAIL", "test@example.com");
  vi.stubEnv("GIT_COMMITTER_NAME", "Test");
  vi.stubEnv("GIT_COMMITTER_EMAIL", "test@example.com");
});
afterEach(() => vi.unstubAllEnvs());

/** A project checkout on `main` and a task branch `fm/k1` with one commit. */
function localSetup() {
  const repo = initRepo();
  git(repo, "checkout", "-q", "-b", "fm/k1");
  commitFile(repo, "a.txt", "a\n", "work");
  git(repo, "checkout", "-q", "main");
  const local = input({ task: task({ mode: "local-only", pullRequestUrl: null }), config: { deliveryMode: "local-only", baseBranch: "main" }, checkoutPath: repo });
  return { repo, local };
}

describe("pull request executor", () => {
  it("[U78] runs `gh pr merge <url> --squash` by default", async () => {
    const { exec, calls } = recordingExec();
    expect(await createMergeExecutor(exec).merge(input())).toEqual({ ok: true });
    expect(calls).toEqual([{ command: "gh", args: ["pr", "merge", PR, "--squash"], cwd: undefined }]);
  });

  it("[U79] maps the merge and rebase methods to their flags", async () => {
    for (const [method, flag] of [["merge", "--merge"], ["rebase", "--rebase"]] as const) {
      const { exec, calls } = recordingExec();
      await createMergeExecutor(exec).merge(input({ method }));
      expect(calls[0]?.args).toEqual(["pr", "merge", PR, flag]);
    }
  });

  it("[U80] falls back to --squash for an unknown merge method", async () => {
    const { exec, calls } = recordingExec();
    await createMergeExecutor(exec).merge(input({ method: "fast-forward" as never }));
    expect(calls[0]?.args).toEqual(["pr", "merge", PR, "--squash"]);
  });

  it("[U81] turns a non-zero gh exit into a failed merge with the error output", async () => {
    const { exec } = recordingExec({ code: 1, stderr: "GraphQL: Pull request is not mergeable" });
    const result = await createMergeExecutor(exec).merge(input());
    expect(result).toEqual({ ok: false, message: expect.stringContaining("Pull request is not mergeable") });
  });

  it("[U82] refuses at preflight a pull request task that has no pull request URL", async () => {
    const { exec, calls } = recordingExec();
    const message = await createMergeExecutor(exec).preflight(input({ task: task({ pullRequestUrl: null }) }));
    expect(message).toMatch(/pull request/i);
    expect(await createMergeExecutor(exec).preflight(input())).toBeNull();
    expect(calls).toEqual([]);
  });

  it("[U219] accepts a pull request URL in the project's own repository whatever the remote form or letter case", async () => {
    const { exec, calls } = recordingExec();
    for (const remote of [REMOTE, "git@github.com:acme/widgets", "https://github.com/acme/widgets.git", "https://github.com/acme/widgets", "git@GitHub.com:Acme/Widgets.git"]) {
      expect(await createMergeExecutor(exec).preflight(input({ remoteUrl: remote })), remote).toBeNull();
    }
    expect(await createMergeExecutor(exec).preflight(input({ task: task({ pullRequestUrl: "https://GitHub.com/ACME/Widgets/pull/12" }) }))).toBeNull();
    expect(calls).toEqual([]);
  });

  it("[U220] refuses a pull request URL on another host, owner, or repository", async () => {
    const { exec } = recordingExec();
    for (const url of ["https://gitlab.com/acme/widgets/pull/7", "https://github.com/evil/widgets/pull/7", "https://github.com/acme/other/pull/7", "http://github.com/acme/widgets/pull/7"]) {
      const message = await createMergeExecutor(exec).preflight(input({ task: task({ pullRequestUrl: url }) }));
      expect(message, url).toMatch(/not a pull request in/i);
    }
  });

  it("[U221] refuses a URL that is not a pull request path", async () => {
    const { exec } = recordingExec();
    for (const url of ["https://github.com/acme/widgets/issues/7", "https://github.com/acme/widgets/pull/abc", "https://github.com/acme/widgets/pull/7/files", "https://github.com/acme/widgets", "https://github.com/acme/widgets/pull/7?x=1", "not a url"]) {
      const message = await createMergeExecutor(exec).preflight(input({ task: task({ pullRequestUrl: url }) }));
      expect(message, url).toMatch(/not a pull request in/i);
    }
  });

  it("[U222] refuses when the project's remote is missing or unreadable", async () => {
    const { exec } = recordingExec();
    for (const remote of [null, "", "not a remote", "file:///tmp/repo.git"]) {
      const message = await createMergeExecutor(exec).preflight(input({ remoteUrl: remote }));
      expect(message, String(remote)).toMatch(/remote/i);
    }
  });
});

describe("local executor", () => {
  it("[U83] refuses at preflight a project without a base branch", async () => {
    const { local } = localSetup();
    const message = await createMergeExecutor(runCommand).preflight({ ...local, config: { ...local.config, baseBranch: null } });
    expect(message).toMatch(/base branch/i);
  });

  it("[U84] refuses at preflight a dirty checkout", async () => {
    const { repo, local } = localSetup();
    commitFile(repo, "b.txt", "b\n", "clean base");
    const { writeFileSync } = await import("node:fs");
    writeFileSync(`${repo}/b.txt`, "dirty\n");
    expect(await createMergeExecutor(runCommand).preflight(local)).toMatch(/uncommitted/i);
  });

  it("[U85] refuses at preflight a checkout that is not on the base branch", async () => {
    const { repo, local } = localSetup();
    git(repo, "checkout", "-q", "fm/k1");
    expect(await createMergeExecutor(runCommand).preflight(local)).toMatch(/main/);
  });

  it("[U86] merges the branch with a merge commit so the base branch holds its commits", async () => {
    const { repo, local } = localSetup();
    expect(await createMergeExecutor(runCommand).preflight(local)).toBeNull();
    expect(await createMergeExecutor(runCommand).merge(local)).toEqual({ ok: true });
    expect(git(repo, "log", "--format=%s", "main")).toContain("work");
    expect(git(repo, "rev-list", "--parents", "-n", "1", "main").trim().split(" ")).toHaveLength(3);
  });

  it("[U87] aborts a conflicting local merge, fails, and leaves the checkout clean", async () => {
    const { repo, local } = localSetup();
    commitFile(repo, "a.txt", "conflict on main\n", "main edits a.txt");
    const result = await createMergeExecutor(runCommand).merge(local);
    expect(result.ok).toBe(false);
    expect(git(repo, "status", "--porcelain")).toBe("");
    expect(git(repo, "log", "--format=%s", "main")).not.toContain("work");
  });
});

describe("executor choice", () => {
  it("[U88] runs gh for the pull request modes and git for local-only", async () => {
    for (const mode of ["no-mistakes", "direct-PR"] as const) {
      const { exec, calls } = recordingExec();
      await createMergeExecutor(exec).merge(input({ task: task({ mode }) }));
      expect(calls[0]?.command).toBe("gh");
    }
    const { exec, calls } = recordingExec();
    await createMergeExecutor(exec).merge(input({ task: task({ mode: "local-only" }), checkoutPath: "/work/repo", config: { baseBranch: "main" } }));
    expect(calls[0]?.command).toBe("git");
  });
});
