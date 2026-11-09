import { describe, expect, it } from "vitest";
import { judgeIsolation } from "./isolation.ts";

const QUIET = [
  "== TCP listeners (empty = unchanged)",
  "(identical)",
  "== shared no-mistakes daemon + ~/.no-mistakes top level",
  "(identical)",
  "== real-home file NAMES (added/removed)",
  "(identical)",
  "== bb / ssh / gh / git / systemd related path changes (names+sizes+mtimes)",
  "(none; the captain's own bb daemon touches daemon.lock.lock every ~15s, ignored)",
  "== credential + git config stat, systemd unit names",
  "(identical)",
  "== firstmate: anything named bblab",
  "entries mentioning bblab:",
  "== docker container set",
  "(identical)",
  "== key processes (only unrelated churn from other lanes may appear; no bblab/48886/48887 lines allowed)",
  "(no lab process lines)",
].join("\n");

const withNames = (...lines: string[]) =>
  QUIET.replace("== real-home file NAMES (added/removed)\n(identical)", `== real-home file NAMES (added/removed)\n${lines.join("\n")}`);

describe("judgeIsolation", () => {
  it("[U1417] is clean for a quiet diff, and ignores churn from other tools", () => {
    expect(judgeIsolation(QUIET)).toEqual({ clean: true, changes: [], ignored: 0 });
    const busy = withNames("721a722,723", "> /home/u/.local/share/opencode/opencode.db-shm", "> /home/u/.local/share/opencode/opencode.db-wal");
    expect(judgeIsolation(busy)).toMatchObject({ clean: true, changes: [], ignored: 2 });
    const logs = QUIET.replace("(none; the captain's own bb daemon", "< /home/u/.bb-machines/x/logs/host-daemon.3.log 1 2026\n> /home/u/.bb-machines/x/logs/host-daemon.3.log 2 2026\n(none; the captain's own bb daemon");
    expect(judgeIsolation(logs).clean).toBe(true);
  });

  it("[U1417] is unclean for a leak line, a changed credential file, or a new name where a harness or bb would write", () => {
    expect(judgeIsolation(`${QUIET}\nLEAK: lab process visible on host`).clean).toBe(false);
    const cred = QUIET.replace("== credential + git config stat, systemd unit names\n(identical)", "== credential + git config stat, systemd unit names\n< /home/u/.codex/auth.json size=1 mtime=a\n> /home/u/.codex/auth.json size=2 mtime=b");
    const credVerdict = judgeIsolation(cred);
    expect(credVerdict.clean).toBe(false);
    expect(credVerdict.changes.join(" ")).toContain("auth.json");
    for (const path of ["/home/u/.pi/agent/models.json", "/home/u/.omp/agent/models.yml", "/home/u/.codex/config.toml", "/home/u/.ssh/known_hosts2", "/home/u/.bb/env.json", "/home/u/.config/gh/hosts.yml", "/home/u/.bblab-x"]) {
      const verdict = judgeIsolation(withNames(`> ${path}`));
      expect(verdict.clean, path).toBe(false);
      expect(verdict.changes.join(" "), path).toContain(path);
    }
  });
});
