import type { Exec } from "../exec";
import type { DeliveryMode } from "../machine/types";

export interface WorktreeReport {
  uncommittedChanges: boolean;
  unpushedCommits: number;
}

export type ReportResult = { ok: true; report: WorktreeReport } | { ok: false; message: string };

export interface ReportInput {
  path: string;
  mode: DeliveryMode;
  baseBranch: string | null;
  /** The host that holds the worktree, or null for the server. */
  host?: string | null;
}

async function git(exec: Exec, cwd: string, args: string[], host: string | null): Promise<{ ok: true; stdout: string } | { ok: false; message: string }> {
  const result = await exec("git", args, { cwd, host });
  if (result.code !== 0) {
    const detail = result.error ?? (result.stderr.trim() || `exit code ${String(result.code)}`);
    return { ok: false, message: `git ${args.join(" ")} failed: ${detail}` };
  }
  return { ok: true, stdout: result.stdout };
}

/**
 * Read the facts that hard rule 2 needs, from git itself. A failed command is
 * an error and never an empty report, so teardown fails closed.
 *
 * The pull request modes count a commit as unpushed when no remote ref holds
 * it, because a squash merge keeps the branch's commits on the remote branch.
 * The `local-only` mode has no remote, so it counts commits that the base
 * branch does not hold.
 */
export async function worktreeReport(exec: Exec, input: ReportInput): Promise<ReportResult> {
  if (input.mode === "local-only" && (input.baseBranch === null || input.baseBranch.trim() === "" || input.baseBranch.startsWith("-"))) {
    return { ok: false, message: "A local-only project needs a base branch to check landed work, and none is configured." };
  }
  const host = input.host ?? null;
  const status = await git(exec, input.path, ["status", "--porcelain"], host);
  if (!status.ok) return status;

  const range =
    input.mode === "local-only" ? ["rev-list", "--count", `${input.baseBranch}..HEAD`] : ["rev-list", "--count", "HEAD", "--not", "--remotes"];
  const count = await git(exec, input.path, range, host);
  if (!count.ok) return count;
  const unpushedCommits = Number.parseInt(count.stdout.trim(), 10);
  if (!Number.isInteger(unpushedCommits) || unpushedCommits < 0) {
    return { ok: false, message: `git ${range.join(" ")} printed an unreadable count.` };
  }
  return { ok: true, report: { uncommittedChanges: status.stdout.trim() !== "", unpushedCommits } };
}
