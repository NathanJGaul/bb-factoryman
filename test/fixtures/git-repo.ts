import { execFileSync } from "node:child_process";
import { mkdtempSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const IDENTITY = ["-c", "user.name=Test", "-c", "user.email=test@example.com", "-c", "commit.gpgsign=false", "-c", "init.defaultBranch=main"];

export function tmpDir(prefix = "fm-git-"): string {
  return realpathSync(mkdtempSync(join(tmpdir(), prefix)));
}

/** Run git synchronously in `cwd` with a fixed identity, and return stdout. */
export function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", [...IDENTITY, ...args], { cwd, encoding: "utf8", env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_SYSTEM: "/dev/null" } });
}

/** A repository on branch `main` with one commit. */
export function initRepo(): string {
  const repo = tmpDir();
  git(repo, "init", "-q", "-b", "main");
  commitFile(repo, "README.md", "hello\n", "init");
  return repo;
}

export function commitFile(repo: string, name: string, content: string, message: string): void {
  writeFileSync(join(repo, name), content);
  git(repo, "add", name);
  git(repo, "commit", "-q", "-m", message);
}

/** A repository with a bare `origin` that already holds `main`. */
export function repoWithRemote(): { repo: string; remote: string } {
  const remote = tmpDir("fm-remote-");
  git(remote, "init", "-q", "--bare", "-b", "main");
  const repo = initRepo();
  git(repo, "remote", "add", "origin", remote);
  git(repo, "push", "-q", "origin", "main");
  return { repo, remote };
}
