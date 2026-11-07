import type { Exec, ExecResult } from "../exec";
import type { ProjectConfig, TaskRow } from "../store/types";

export type MergeMethod = "squash" | "merge" | "rebase";

export interface MergeInput {
  task: TaskRow;
  config: ProjectConfig;
  /** The project checkout, needed for `local-only`. */
  checkoutPath: string | null;
  method: MergeMethod;
}

export type MergeResult = { ok: true } | { ok: false; message: string };

export interface MergeExecutor {
  /** A refusal message, or null when a merge may start. */
  preflight(input: MergeInput): Promise<string | null>;
  merge(input: MergeInput): Promise<MergeResult>;
}

const FLAGS: Record<MergeMethod, string> = { squash: "--squash", merge: "--merge", rebase: "--rebase" };

/** Anything that is not a known method merges by squash, so a typo in a setting cannot widen what a merge does. */
function methodFlag(method: string): string {
  return FLAGS[method as MergeMethod] ?? FLAGS.squash;
}

function describe(result: ExecResult): string {
  return result.error ?? (result.stderr.trim() || result.stdout.trim() || `exit code ${String(result.code)}`);
}

function pullRequestExecutor(exec: Exec): MergeExecutor {
  return {
    async preflight({ task }) {
      return task.pullRequestUrl === null ? "The task has no pull request URL, so there is nothing to merge." : null;
    },
    async merge({ task, method }) {
      if (task.pullRequestUrl === null) return { ok: false, message: "The task has no pull request URL." };
      const result = await exec("gh", ["pr", "merge", task.pullRequestUrl, methodFlag(method)]);
      return result.code === 0 ? { ok: true } : { ok: false, message: `gh pr merge failed: ${describe(result)}` };
    },
  };
}

function localExecutor(exec: Exec): MergeExecutor {
  const git = (cwd: string, args: string[]) => exec("git", args, { cwd });
  return {
    async preflight({ task, config, checkoutPath }) {
      const base = config.baseBranch;
      if (base === null || base.trim() === "" || base.startsWith("-")) return "A local-only project needs a base branch, and none is configured.";
      if (checkoutPath === null) return "bb reports no checkout for this project, so there is nowhere to merge.";
      if (task.branch === null) return "The task has no branch to merge.";
      const status = await git(checkoutPath, ["status", "--porcelain"]);
      if (status.code !== 0) return `Could not read the project checkout: ${describe(status)}`;
      if (status.stdout.trim() !== "") return "The project checkout has uncommitted changes, so a local merge is refused.";
      const head = await git(checkoutPath, ["rev-parse", "--abbrev-ref", "HEAD"]);
      if (head.code !== 0 || head.stdout.trim() !== base) return `The project checkout is not on the base branch \`${base}\`.`;
      const branch = await git(checkoutPath, ["rev-parse", "--verify", `refs/heads/${task.branch}`]);
      return branch.code === 0 ? null : `The branch \`${task.branch}\` does not exist in the project checkout.`;
    },
    async merge({ task, checkoutPath }) {
      if (checkoutPath === null || task.branch === null) return { ok: false, message: "No checkout or branch to merge." };
      const merged = await git(checkoutPath, ["merge", "--no-ff", "--no-edit", task.branch]);
      if (merged.code === 0) return { ok: true };
      await git(checkoutPath, ["merge", "--abort"]);
      return { ok: false, message: `git merge failed and was aborted: ${describe(merged)}` };
    },
  };
}

/** Choose the executor by delivery mode: the pull request modes use `gh`, and `local-only` uses `git`. */
export function createMergeExecutor(exec: Exec): MergeExecutor {
  const pullRequest = pullRequestExecutor(exec);
  const local = localExecutor(exec);
  const pick = (input: MergeInput) => (input.task.mode === "local-only" ? local : pullRequest);
  return {
    preflight: (input) => pick(input).preflight(input),
    merge: (input) => pick(input).merge(input),
  };
}
