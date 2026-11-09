import { spawnSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { tmpDir } from "../../test/fixtures/git-repo";
import { READ_SCRIPT } from "./agent";

/** Run the one command of the observation under a real `sh`, with exactly the environment given and nothing else. */
function read(env: Record<string, string>) {
  const run = spawnSync("sh", ["-c", READ_SCRIPT], { env: { PATH: process.env["PATH"] ?? "/usr/bin:/bin", ...env }, encoding: "utf8" });
  return { status: run.status, stdout: run.stdout, stderr: run.stderr };
}

/** A home directory, and the configuration file that no-mistakes keeps in it (or in `NM_HOME`). */
function homes() {
  const home = tmpDir("agent-shell-home-");
  const nm = tmpDir("agent-shell-nm-");
  const put = (dir: string, text: string) => {
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "config.yaml"), text);
  };
  return { home, nm, putHome: (text: string) => put(join(home, ".no-mistakes"), text), putNm: (text: string) => put(nm, text) };
}

/** Every path under the directories with its size and modification time, so a write of any kind shows. */
function snapshot(...dirs: string[]): string[] {
  return dirs.flatMap((dir) => readdirSync(dir, { recursive: true, encoding: "utf8" }).sort().map((entry) => `${dir}/${entry}:${statSync(join(dir, entry)).size}:${statSync(join(dir, entry)).mtimeMs}`));
}

describe("READ_SCRIPT under a real sh", () => {
  it("[U1723] prints the configuration file and exits 0 when the file exists", () => {
    const h = homes();
    h.putNm("agent: codex\nlog_level: info\n");
    expect(read({ HOME: h.home, NM_HOME: h.nm })).toEqual({ status: 0, stdout: "agent: codex\nlog_level: info\n", stderr: "" });
  });

  it("[U1724] exits 3 and prints nothing when the file does not exist", () => {
    const h = homes();
    expect(read({ HOME: h.home, NM_HOME: h.nm })).toEqual({ status: 3, stdout: "", stderr: "" });
    expect(read({ HOME: h.home })).toEqual({ status: 3, stdout: "", stderr: "" });
  });

  it("[U1725] reads $NM_HOME/config.yaml when NM_HOME is set, and $HOME/.no-mistakes/config.yaml when it is not", () => {
    const h = homes();
    h.putHome("agent: pi\n");
    h.putNm("agent: codex\n");
    expect(read({ HOME: h.home, NM_HOME: h.nm }).stdout).toBe("agent: codex\n");
    expect(read({ HOME: h.home }).stdout).toBe("agent: pi\n");
    // An empty NM_HOME counts as unset, as the shell's ${NM_HOME:-...} does.
    expect(read({ HOME: h.home, NM_HOME: "" }).stdout).toBe("agent: pi\n");
  });

  it("[U1726] changes nothing in the home directory or in the no-mistakes directory, whether the file exists or not", () => {
    const h = homes();
    h.putHome("agent: pi\n");
    h.putNm("agent: codex\n");
    const empty = tmpDir("agent-shell-empty-");
    const dirs = [h.home, h.nm, empty];
    const before = snapshot(...dirs);
    read({ HOME: h.home, NM_HOME: h.nm });
    read({ HOME: h.home });
    read({ HOME: empty, NM_HOME: empty });
    expect(snapshot(...dirs)).toEqual(before);
    expect(readFileSync(join(h.nm, "config.yaml"), "utf8")).toBe("agent: codex\n");
  });
});
