import { type SpawnSyncReturns, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { tmpDir } from "../../test/fixtures/git-repo.ts";

const BBLAB = new URL("./bblab", import.meta.url).pathname;
const EVIDENCE = new URL("./bblab-evidence", import.meta.url).pathname;

function run(args: string[], env: Record<string, string> = {}, lab = join(tmpDir("bblab-test-"), "lab")): SpawnSyncReturns<string> & { lab: string } {
  const result = spawnSync("bash", [BBLAB, ...args], {
    encoding: "utf8",
    env: { PATH: process.env["PATH"] ?? "", HOME: process.env["HOME"] ?? "", BBLAB_DIR: lab, BBLAB_SERVER_PORT: "48911", BBLAB_DAEMON_PORT: "48912", ...env },
  });
  return Object.assign(result, { lab });
}

describe("bblab plan", () => {
  it("[U1345] prints the sandbox arguments, the lab directory, and the ports without starting or creating anything", () => {
    const result = run(["plan"]);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("--unshare-pid");
    expect(result.stdout).toContain("--ro-bind /usr /usr");
    expect(result.stdout).toContain(`lab: ${result.lab}`);
    expect(result.stdout).toContain("server-port: 48911");
    expect(result.stdout).toContain("daemon-port: 48912");
    expect(existsSync(result.lab)).toBe(false);
  });

  it("[U1346] adds --unshare-net with --offline or BBLAB_OFFLINE=1, and does not add it by default", () => {
    expect(run(["plan"]).stdout).not.toContain("--unshare-net");
    expect(run(["plan", "--offline"]).stdout).toContain("--unshare-net");
    expect(run(["plan"], { BBLAB_OFFLINE: "1" }).stdout).toContain("--unshare-net");
    expect(run(["plan", "--offline"]).stdout).toContain("network: offline");
    expect(run(["plan"]).stdout).toContain("network: shared");
  });

  it("[U1347] joins the network namespace and probes readiness inside the lab when the lab is offline", () => {
    const offline = run(["plan", "--offline"]).stdout;
    expect(offline).toMatch(/nsenter:.* --net /);
    expect(offline).toContain("ready-probe: inside the lab");
    // A curl inside the lab opens the canary known_hosts file and trips the tripwire, so the probe uses node.
    expect(readFileSync(BBLAB, "utf8")).not.toMatch(/lab_x curl/);
    const shared = run(["plan"]).stdout;
    expect(shared).not.toMatch(/nsenter:.* --net /);
    expect(shared).toContain("ready-probe: host");
  });

  it("[U1348] refuses a lab directory under firstmate, a reserved port, and an unknown flag", () => {
    const lab = run(["plan"], {}, "/home/x/Projects/firstmate/lab");
    expect(lab.status).not.toBe(0);
    expect(lab.stderr).toMatch(/refusing lab dir/);
    const port = run(["plan"], { BBLAB_SERVER_PORT: "38888" });
    expect(port.status).not.toBe(0);
    expect(port.stderr).toMatch(/port 38888 is reserved/);
    const flag = run(["plan", "--bogus"]);
    expect(flag.status).toBe(2);
  });
});

describe("the lab scripts", () => {
  it("[U1349] parse with bash -n, and a tripwire report with only directory events cannot abort bblab down", () => {
    for (const script of [BBLAB, EVIDENCE]) {
      const check = spawnSync("bash", ["-n", script], { encoding: "utf8" });
      expect(check.status, `${script}: ${check.stderr}`).toBe(0);
    }
    const lab = join(tmpDir("bblab-down-"), "lab");
    mkdirSync(join(lab, "logs"), { recursive: true });
    mkdirSync(join(lab, "run"), { recursive: true });
    writeFileSync(join(lab, "logs", "tripwire.txt"), "12:00:00 OPEN,ISDIR " + join(lab, "canary-home", ".ssh") + "/\n");
    const down = run(["down"], {}, lab);
    expect(down.status, down.stderr + down.stdout).toBe(0);
    expect(down.stdout).toContain("bblab down: done");
  });
});
