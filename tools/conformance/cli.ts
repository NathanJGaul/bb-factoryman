// pnpm run conformance -- --tier <1|1.5> [--harness <id>] [options]
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadGaps } from "./gaps.ts";
import { openRealLab } from "./real-lab.ts";
import { main, type RunDeps } from "./run.ts";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

function which(command: string): string | null {
  for (const dir of (process.env["PATH"] ?? "").split(":")) {
    const candidate = join(dir, command);
    if (existsSync(candidate)) return realpathSync(candidate);
  }
  return null;
}

function git(...args: string[]): string {
  return execFileSync("git", args, { cwd: repoRoot, encoding: "utf8" }).trim();
}

const deps: RunDeps = {
  which,
  openLab: (args, driver, binds) =>
    openRealLab({ repoRoot, args, driver, binds, hostEnv: process.env, which, progress: (line) => process.stdout.write(`  ${line}\n`) }),
  loadGaps: () => loadGaps(join(repoRoot, "conformance/known-gaps.json")),
  plugin: async () => ({ commit: git("rev-parse", "--short", "HEAD"), dirty: git("status", "--porcelain", "--", "src", "package.json", "pnpm-lock.yaml") !== "" }),
  now: () => new Date().toISOString(),
  async writeFile(path, text) {
    const full = resolve(repoRoot, path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, text);
  },
  out: (line) => process.stdout.write(`${line}\n`),
};

process.exitCode = await main(process.argv.slice(2), deps);
