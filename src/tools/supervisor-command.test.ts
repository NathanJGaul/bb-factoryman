import { describe, expect, it } from "vitest";
import { withDispatchedTask } from "../../test/fixtures/runtime";
import { testRuntime } from "../../test/fixtures/runtime";
import { modelEntry, providerState } from "../../test/fixtures/bb-port";
import { answerRead, isRead } from "../../test/fixtures/validator-read";
import { defaultProjectConfig } from "../store/store";
import { runFactorymanCommand } from "./supervisor-command";

describe("bb factoryman supervisor", () => {
  it("[U117] stamps the supervisor role on a thread and prints a confirmation", async () => {
    const t = await withDispatchedTask();
    const result = await runFactorymanCommand(t.runtime, ["supervisor", "thr-new"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("thr-new");
    expect(t.bb.callsTo("setThreadMetadata")).toEqual([["thr-new", { role: "supervisor" }]]);
  });

  describe("the advice after a stamp", () => {
    async function stampWith(provider: string | null | "throws" | "unknown-thread") {
      const t = await withDispatchedTask();
      if (provider === "throws") t.bb.getThreadError = new Error("HTTP 500");
      else if (provider !== "unknown-thread") t.bb.addThread({ id: "thr-new", providerId: provider });
      const result = await runFactorymanCommand(t.runtime, ["supervisor", "thr-new"]);
      return { result, t };
    }

    it.each([["codex"], ["acp-omp"]])("[U1644] tells the owner to clear a %s thread", async (provider) => {
      const { result } = await stampWith(provider);
      expect(result.exitCode).toBe(0);
      expect(result.stdout?.split("\n")[0]).toBe("Thread thr-new is now a factoryman supervisor.");
      expect(result.stdout).toContain(`This harness (${provider})`);
      expect(result.stdout).toContain("`bb thread clear thr-new`");
    });

    it.each([["claude-code"], ["pi"]])("[U1645] says the tools of a %s thread arrive at the next turn, with no clear", async (provider) => {
      const { result } = await stampWith(provider);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("on its next turn.");
      expect(result.stdout).not.toMatch(/clear/i);
    });

    it("[U1646] gives the generic clear advice and names the provider when the provider has no contract row", async () => {
      const { result } = await stampWith("acp-hermes-agent");
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("The harness acp-hermes-agent has no recorded role-change behavior.");
      expect(result.stdout).toContain("`bb thread clear thr-new`");
    });

    it("[U1647] still stamps and says that bb did not name the harness when the provider is null, the thread is unknown, or the read throws", async () => {
      for (const provider of [null, "unknown-thread", "throws"] as const) {
        const { result, t } = await stampWith(provider);
        expect(result.exitCode, String(provider)).toBe(0);
        expect(result.stdout, String(provider)).toContain("bb did not say which harness the thread uses (");
        expect(result.stdout, String(provider)).toContain("`bb thread clear thr-new`");
        expect(t.bb.callsTo("setThreadMetadata")).toEqual([["thr-new", { role: "supervisor" }]]);
      }
      expect((await stampWith("throws")).result.stdout).toContain("HTTP 500");
    });

    it("[U1648] never says from its next session, for any provider", async () => {
      for (const provider of ["codex", "acp-omp", "claude-code", "pi", "acp-x", null, "throws", "unknown-thread"] as const) {
        const { result } = await stampWith(provider);
        expect(`${result.stdout ?? ""}${result.stderr ?? ""}`, String(provider)).not.toContain("from its next session");
      }
    });

    it("[U1649] refuses a recorded worker thread, stamps nothing, and reads no thread", async () => {
      const t = await withDispatchedTask();
      const readsBefore = t.bb.callsTo("getThread").length; // the fixture's dispatch read the worker thread already
      const result = await runFactorymanCommand(t.runtime, ["supervisor", "thr-w1"]);
      expect(result.exitCode).toBe(1);
      expect(t.bb.callsTo("setThreadMetadata")).toEqual([]);
      expect(t.bb.callsTo("getThread")).toHaveLength(readsBefore);
    });

    it("[U1650] prints no advice, exits 1 with bb's reason, and reads no thread when bb rejects the stamp", async () => {
      const t = await withDispatchedTask();
      const readsBefore = t.bb.callsTo("getThread").length;
      t.bb.setMetadataError = new Error("HTTP 404: thread not found");
      const result = await runFactorymanCommand(t.runtime, ["supervisor", "thr-new"]);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("Could not stamp thread thr-new: HTTP 404: thread not found");
      expect(result.stdout).toBeUndefined();
      expect(t.bb.callsTo("getThread")).toHaveLength(readsBefore);
    });
  });

  it("[U118] refuses a recorded worker thread and stamps nothing", async () => {
    const t = await withDispatchedTask();
    const result = await runFactorymanCommand(t.runtime, ["supervisor", "thr-w1"]);
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toMatch(/worker/i);
    expect(t.bb.callsTo("setThreadMetadata")).toEqual([]);
  });

  it("[U1642] routes the word start to the start command, and stamps any other first word as a thread ID", async () => {
    const t = await withDispatchedTask();
    t.bb.checkouts.set("proj-1", "/work/repo");
    const started = await runFactorymanCommand(t.runtime, ["supervisor", "start", "--project", "proj-1"]);
    expect(started.exitCode).toBe(1);
    expect(started.stderr).toContain("No supervisor profile is set for project proj-1.");
    expect(t.bb.callsTo("setThreadMetadata")).toEqual([]);
    const stamped = await runFactorymanCommand(t.runtime, ["supervisor", "thr-new"]);
    expect(stamped.exitCode).toBe(0);
    expect(t.bb.callsTo("setThreadMetadata")).toEqual([["thr-new", { role: "supervisor" }]]);
  });

  it("[U1643] lists the supervisor lines first in the usage text, the stamp line and then the start line", async () => {
    const t = await withDispatchedTask();
    const usage = (await runFactorymanCommand(t.runtime, ["nope"])).stderr ?? "";
    const lines = usage.split("\n");
    expect(lines[0]).toBe("Usage: bb factoryman supervisor <thread-id>");
    expect(lines[1]).toBe("Usage: bb factoryman supervisor start [--project <id>] [--profile <name>] [--prompt <text>]");
  });

  it("[U119] prints usage and exits non-zero without a thread ID or with an unknown command", async () => {
    const t = await withDispatchedTask();
    for (const argv of [["supervisor"], [], ["nope"]]) {
      const result = await runFactorymanCommand(t.runtime, argv);
      expect(result.exitCode, argv.join(" ")).not.toBe(0);
      expect(result.stderr).toContain("Usage: bb factoryman supervisor <thread-id>");
    }
    expect(t.bb.callsTo("setThreadMetadata")).toEqual([]);
  });

  describe("preflight", () => {
    function remoteRuntime(modeOverride: "no-mistakes" | "direct-PR" | "local-only" = "no-mistakes") {
      const t = testRuntime();
      t.bb.machines.push({ id: "host_gpu", name: "gpu-box", status: "connected", phase: "active", online: true });
      t.bb.sources.push({ hostId: "host_gpu", path: "/work/gpu", isDefault: false });
      t.runtime.deps.store.putProjectConfig({ projectId: "proj-1", deliveryMode: modeOverride, yolo: false, branchPrefix: null, baseBranch: null, defaultMachine: null });
      return t;
    }

    it("[U856] runs the preflight for a machine and project and prints a ready report", async () => {
      const t = remoteRuntime();
      const ok = await runFactorymanCommand(t.runtime, ["preflight", "gpu-box", "--project", "proj-1"]);
      expect(ok.exitCode).toBe(0);
      expect(ok.stdout).toContain("gpu-box");
      expect(ok.stdout).toMatch(/ready/);
      // The validator read (feature 011) opens a file under the home directory and needs no working directory.
      expect(t.execCalls.filter((call) => !isRead(call.command, call.args)).every((call) => call.cwd === "/work/gpu")).toBe(true);
      expect(t.execCalls.filter((call) => isRead(call.command, call.args)).map((call) => call.cwd)).toEqual([undefined]);
    });

    it("[U856] exits 1 and prints the failed check when the machine is missing something", async () => {
      const t = remoteRuntime();
      t.execHandler = (command, args) => (command === "gh" && args[0] === "auth" ? { code: 1, stdout: "", stderr: "not logged in" } : { code: 0, stdout: "", stderr: "" });
      const failed = await runFactorymanCommand(t.runtime, ["preflight", "gpu-box", "--project", "proj-1"]);
      expect(failed.exitCode).toBe(1);
      expect(failed.stdout).toContain("gh_credentials");
    });

    it("[U856] takes the project from the command context when --project is absent", async () => {
      const t = remoteRuntime();
      t.execHandler = () => ({ code: 1, stdout: "", stderr: "" });
      const viaContext = await runFactorymanCommand(t.runtime, ["preflight", "gpu-box"], { projectId: "proj-1" });
      expect(viaContext.exitCode).toBe(1);
      expect(t.bb.callsTo("getProjectSources")).toEqual([["proj-1"]]);
    });

    it.each([[["preflight"]], [["preflight", "gpu-box"]], [["preflight", "gpu-box", "--project"]], [["preflight", "gpu-box", "--bogus", "x"]]])("[U856] prints usage and exits 2 for `%j`", async (argv) => {
      const t = remoteRuntime();
      const bad = await runFactorymanCommand(t.runtime, argv);
      expect(bad.exitCode).toBe(2);
      expect(bad.stderr).toContain("Usage: bb factoryman preflight <machine> --project <project-id>");
      expect(t.execCalls).toEqual([]);
    });

    it("[U856] reports an unknown machine and runs nothing", async () => {
      const t = remoteRuntime();
      const unknown = await runFactorymanCommand(t.runtime, ["preflight", "nowhere", "--project", "proj-1"]);
      expect(unknown.exitCode).toBe(1);
      expect(unknown.stderr).toContain("machine_unknown");
      expect(t.execCalls).toEqual([]);
    });

    it("[U1696] exits 1 with a validator_agent problem when the validator agent is not ready, and exits 0 and names the agent when it is ready", async () => {
      const t = remoteRuntime();
      t.bb.states = [providerState("claude"), providerState("claude-code"), providerState("codex", { status: "unauthenticated", localLoginCommand: "codex login" })];
      t.execHandler = answerRead("agent: codex\n");
      const failed = await runFactorymanCommand(t.runtime, ["preflight", "gpu-box", "--project", "proj-1"]);
      expect(failed.exitCode).toBe(1);
      expect(failed.stdout).toContain("validator_agent: codex (bb provider codex) is not ready on gpu-box");
      t.execHandler = answerRead("agent: claude\n");
      const ready = await runFactorymanCommand(t.runtime, ["preflight", "gpu-box", "--project", "proj-1"]);
      expect(ready.exitCode).toBe(0);
      expect(ready.stdout).toContain("is ready for no-mistakes mode work.");
      expect(ready.stdout).toContain("Validator agent: claude (bb provider claude-code) is ready on gpu-box.");
    });

    it("[U874] says that the host which holds the clone needs no remote preflight, and runs nothing", async () => {
      const t = remoteRuntime();
      const result = await runFactorymanCommand(t.runtime, ["preflight", "local-box", "--project", "proj-1"]);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("holds the project's clone");
      expect(t.execCalls).toEqual([]);
    });

    it("[U873] skips the checks that the delivery mode does not need, and reports a machine that is offline", async () => {
      const t = remoteRuntime("local-only");
      const ok = await runFactorymanCommand(t.runtime, ["preflight", "gpu-box", "--project", "proj-1"]);
      expect(ok.exitCode).toBe(0);
      expect(t.execCalls.map((call) => call.command)).not.toContain("gh");
      t.bb.machines[1] = { id: "host_gpu", name: "gpu-box", status: "disconnected", phase: "active", online: false };
      const offline = await runFactorymanCommand(t.runtime, ["preflight", "gpu-box", "--project", "proj-1"]);
      expect(offline.exitCode).toBe(1);
      expect(offline.stderr).toContain("machine_offline");
    });
  });

  describe("protection and import-registry", () => {
    const registry = ["- gadgets [direct-PR +yolo branch=wip/] - Direct (added 2026-01-02)", "- mystery [wibble] - Unknown (added 2026-01-03)"].join("\n");

    it("[U1030] prints the protection checklist, with the defaults, and prints usage for a bad call", async () => {
      const t = testRuntime();
      const ok = await runFactorymanCommand(t.runtime, ["protection", "acme/widgets"]);
      expect(ok.exitCode).toBe(0);
      expect(ok.stdout).toContain("branches/main/protection");
      expect(ok.stdout).toContain('"contexts": ["no-mistakes"]');
      expect(t.execCalls).toEqual([]);
      for (const argv of [["protection"], ["protection", "acme"], ["protection", "acme/widgets", "--branch"], ["protection", "acme/widgets", "--bogus", "x"], ["protection", "acme/widgets", "--branch", "a b"]]) {
        const bad = await runFactorymanCommand(t.runtime, argv);
        expect(bad.exitCode, argv.join(" ")).toBe(2);
        expect(bad.stderr).toContain("Usage: bb factoryman protection <owner/repo>");
      }
    });

    it("[U1030] reports the registry, matching projects by name, and reads nothing else", async () => {
      const t = testRuntime();
      t.files.files.set("/reg/projects.md", registry);
      t.bb.projectList = [{ id: "proj-9", name: "Gadgets" }];
      const result = await runFactorymanCommand(t.runtime, ["import-registry", "--file", "/reg/projects.md"]);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("gadgets | direct-PR | direct-PR | on | wip/ | none | proj-9");
      expect(result.stdout).toContain("mystery | wibble | unknown |");
      expect(result.stdout).toContain("Dry run: nothing was written.");
      expect(t.files.reads).toEqual(["/reg/projects.md"]);
      expect(t.runtime.deps.store.getProjectConfig("proj-9").yolo).toBe(false);
    });

    it("[U1065] says that the bb projects could not be listed, and still prints the table", async () => {
      const t = testRuntime();
      t.files.files.set("/reg/projects.md", registry);
      t.bb.projectsError = new Error("bb is down");
      const result = await runFactorymanCommand(t.runtime, ["import-registry", "--file", "/reg/projects.md"]);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("could not be listed");
      expect(result.stdout).toContain("bb is down");
      expect(result.stdout).toContain("gadgets | direct-PR | direct-PR | on | wip/ | none | not found in bb");
    });

    it("[U1066] prints usage for an unknown flag next to a good --file, and reads nothing", async () => {
      const t = testRuntime();
      t.files.files.set("/reg/projects.md", registry);
      for (const argv of [["import-registry", "--file", "/reg/projects.md", "--bogus"], ["import-registry", "--bogus", "--file", "/reg/projects.md"], ["import-registry", "--file", "/reg/projects.md", "extra"]]) {
        const bad = await runFactorymanCommand(t.runtime, argv);
        expect(bad.exitCode, argv.join(" ")).toBe(2);
      }
      expect(t.files.reads).toEqual([]);
    });

    it("[U1030] prints usage without a file, and reports a file that cannot be read", async () => {
      const t = testRuntime();
      t.files.files.set("/reg/projects.md", registry);
      for (const argv of [["import-registry"], ["import-registry", "--file"], ["import-registry", "--bogus", "x"]]) {
        const bad = await runFactorymanCommand(t.runtime, argv);
        expect(bad.exitCode, argv.join(" ")).toBe(2);
        expect(bad.stderr).toContain("Usage: bb factoryman import-registry --file <path>");
      }
      const missing = await runFactorymanCommand(t.runtime, ["import-registry", "--file", "/nope.md"]);
      expect(missing.exitCode).toBe(1);
      expect(missing.stderr).toMatch(/could not read/i);
      t.files.errors.set("/err.md", new Error("EACCES: permission denied"));
      const denied = await runFactorymanCommand(t.runtime, ["import-registry", "--file", "/err.md"]);
      expect(denied.exitCode).toBe(1);
      expect(denied.stderr).toContain("EACCES");
    });
  });
});

const APPLY_REGISTRY = [
  "- gizmos [direct-PR +yolo branch=wip/] - Direct (added 2026-01-02)",
  "- gadgets [no-mistakes-prod-only] - Conditional (added 2026-01-03)",
  "- mystery [wibble] - Unknown (added 2026-01-04)",
  "- dup [local-only] - One (added 2026-01-05)",
  "- dup [direct-PR] - Two (added 2026-01-06)",
].join("\n");

function applyRuntime() {
  const t = testRuntime();
  t.files.files.set("/reg/projects.md", APPLY_REGISTRY);
  t.bb.projectList = [
    { id: "proj-gizmos", name: "Gizmos" },
    { id: "proj-gadgets", name: "gadgets" },
    { id: "proj-mystery", name: "mystery" },
    { id: "proj-dup", name: "dup" },
  ];
  return t;
}

const apply = (t: ReturnType<typeof applyRuntime>, ...rest: string[]) => runFactorymanCommand(t.runtime, ["import-registry", "--file", "/reg/projects.md", ...rest]);

describe("bb factoryman import-registry dry run (characterization)", () => {
  it("[U1909] prints today's report byte for byte and never writes", async () => {
    const t = testRuntime();
    t.files.files.set("/reg/projects.md", ["- gadgets [direct-PR +yolo branch=wip/] - Direct (added 2026-01-02)", "- mystery [wibble] - Unknown (added 2026-01-03)"].join("\n"));
    t.bb.projectList = [{ id: "proj-9", name: "Gadgets" }];
    const before = JSON.stringify(t.runtime.deps.store.getProjectConfig("proj-9"));
    const result = await runFactorymanCommand(t.runtime, ["import-registry", "--file", "/reg/projects.md"]);
    expect(result).toEqual({
      exitCode: 0,
      stdout: [
        "Registry /reg/projects.md: 2 projects, 0 other lines skipped.",
        "Dry run: nothing was written. A project keeps its stored config (no-mistakes, yolo off) until a person sets it.",
        "",
        "name | registered mode | plugin mode | yolo | branch prefix | forge | bb project",
        "gadgets | direct-PR | direct-PR | on | wip/ | none | proj-9",
        "mystery | wibble | unknown | off | fm/ | none | not found in bb",
        "",
        "Flags (look at these before the cutover):",
        "- mystery: unknown mode `wibble`: the plugin does not guess a mode",
        "",
      ].join("\n"),
    });
    expect(JSON.stringify(t.runtime.deps.store.getProjectConfig("proj-9"))).toBe(before);
  });
});

describe("bb factoryman import-registry --apply", () => {
  it.each([
    ["--apply without --project", ["--apply"]],
    ["--project without --apply", ["--project", "gizmos"]],
    ["--project twice", ["--apply", "--project", "gizmos", "--project", "gadgets"]],
    ["--project with no value", ["--apply", "--project"]],
    ["--project with a flag as its value", ["--apply", "--project", "--apply"]],
    ["--project with a blank value", ["--apply", "--project", " "]],
    ["an unknown flag", ["--apply", "--project", "gizmos", "--bogus"]],
    ["a stray argument", ["--apply", "--project", "gizmos", "extra"]],
  ])("[U1904] prints the usage for %s, and reads and writes nothing", async (_label, flags) => {
    const t = applyRuntime();
    const result = await apply(t, ...flags);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("Usage: bb factoryman import-registry --file <path> --apply --project <name>");
    expect(t.files.reads).toEqual([]);
    expect(t.bb.callsTo("listProjects")).toEqual([]);
    expect(t.runtime.deps.store.getProjectConfig("proj-gizmos")).toEqual(defaultProjectConfig("proj-gizmos"));
  });

  it("[U1905] writes the config of the named project, says what it wrote and left, and reads only the registry file", async () => {
    const t = applyRuntime();
    const store = t.runtime.deps.store;
    store.putProjectConfig({ ...defaultProjectConfig("proj-gizmos"), baseBranch: "trunk", defaultMachine: "m-1" });
    const result = await apply(t, "--apply", "--project", "gizmos");
    expect(result.exitCode).toBe(0);
    expect(store.getProjectConfig("proj-gizmos")).toEqual({ projectId: "proj-gizmos", deliveryMode: "direct-PR", yolo: true, branchPrefix: "wip/", baseBranch: "trunk", defaultMachine: "m-1" });
    const out = result.stdout ?? "";
    expect(out).toContain('Applied registry line "gizmos" to bb project proj-gizmos.');
    expect(out).toMatch(/written:\n {2}deliveryMode: no-mistakes -> direct-PR\n {2}yolo: off -> on\n {2}branchPrefix: \(none\) -> wip\//);
    expect(out).toMatch(/unchanged:\n {2}baseBranch: trunk \(not in the registry\)\n {2}defaultMachine: m-1 \(not in the registry\)/);
    expect(out).toContain("Forge none is not stored.");
    expect(t.files.reads).toEqual(["/reg/projects.md"]);
    expect(store.getProjectConfig("proj-gadgets")).toEqual(defaultProjectConfig("proj-gadgets"));
    expect(t.execCalls).toEqual([]);
  });

  it("[U1905] prints the notes of the line", async () => {
    const t = applyRuntime();
    const result = await apply(t, "--apply", "--project", "gadgets");
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Notes:");
    expect(result.stdout).toMatch(/- gadgets: a conditional policy in firstmate/);
    expect(t.runtime.deps.store.getProjectConfig("proj-gadgets").deliveryMode).toBe("no-mistakes");
  });

  it("[U1906] writes nothing on a rerun and says so", async () => {
    const t = applyRuntime();
    const store = t.runtime.deps.store;
    expect((await apply(t, "--apply", "--project", "gizmos")).exitCode).toBe(0);
    const writes: unknown[] = [];
    const put = store.putProjectConfig.bind(store);
    store.putProjectConfig = (config) => {
      writes.push(config);
      put(config);
    };
    const before = JSON.stringify(store.getProjectConfig("proj-gizmos"));
    const again = await apply(t, "--apply", "--project", "gizmos");
    expect(again.exitCode).toBe(0);
    expect(writes).toEqual([]);
    expect(JSON.stringify(store.getProjectConfig("proj-gizmos"))).toBe(before);
    expect(again.stdout).toContain("Nothing was written.");
    expect(again.stdout).not.toContain("written:");
    expect(again.stdout).toMatch(/unchanged:\n {2}deliveryMode: direct-PR\n {2}yolo: on\n {2}branchPrefix: wip\//);
  });

  it.each([
    ["no registry line for the name", ["--project", "nothing"], /registry has no project named nothing/],
    ["two registry lines", ["--project", "dup"], /2 lines named dup/],
    ["a flagged line", ["--project", "mystery"], /flagged.*unknown mode `wibble`/],
  ])("[U1907] refuses %s with exit 1 and the reason, and writes nothing", async (_label, flags, reason) => {
    const t = applyRuntime();
    const result = await apply(t, "--apply", ...flags);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toMatch(reason);
    expect(result.stdout ?? "").toBe("");
    for (const id of ["proj-gizmos", "proj-gadgets", "proj-mystery", "proj-dup"]) {
      expect(t.runtime.deps.store.getProjectConfig(id)).toEqual(defaultProjectConfig(id));
    }
  });

  it("[U1907] refuses a project that bb does not list, and two bb projects with the name", async () => {
    const t = applyRuntime();
    t.bb.projectList = [{ id: "a", name: "other" }];
    const unknown = await apply(t, "--apply", "--project", "gizmos");
    expect(unknown.exitCode).toBe(1);
    expect(unknown.stderr).toContain("bb has no project named gizmos");
    t.bb.projectList = [{ id: "a", name: "gizmos" }, { id: "b", name: "Gizmos" }];
    const twice = await apply(t, "--apply", "--project", "gizmos");
    expect(twice.exitCode).toBe(1);
    expect(twice.stderr).toContain("2 projects named gizmos");
    expect(t.runtime.deps.store.getProjectConfig("a")).toEqual(defaultProjectConfig("a"));
  });

  it("[U1907] refuses when bb cannot list its projects, and logs a warning", async () => {
    const t = applyRuntime();
    t.bb.projectsError = new Error("bb is down");
    const result = await apply(t, "--apply", "--project", "gizmos");
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("could not be listed");
    expect(result.stderr).toContain("bb is down");
    expect(t.lines.some((line) => line.level === "warn" && line.message.includes("bb is down"))).toBe(true);
    expect(t.runtime.deps.store.getProjectConfig("proj-gizmos")).toEqual(defaultProjectConfig("proj-gizmos"));
  });

  it("[U1907] reports a missing or unreadable registry file as the dry run does, and writes nothing", async () => {
    const t = applyRuntime();
    const missing = await runFactorymanCommand(t.runtime, ["import-registry", "--file", "/nope.md", "--apply", "--project", "gizmos"]);
    expect(missing.exitCode).toBe(1);
    expect(missing.stderr).toBe("Could not read /nope.md: the file does not exist.\n");
    t.files.errors.set("/err.md", new Error("EACCES: permission denied"));
    const denied = await runFactorymanCommand(t.runtime, ["import-registry", "--file", "/err.md", "--apply", "--project", "gizmos"]);
    expect(denied.exitCode).toBe(1);
    expect(denied.stderr).toContain("EACCES");
    expect(t.runtime.deps.store.getProjectConfig("proj-gizmos")).toEqual(defaultProjectConfig("proj-gizmos"));
  });

  it("[U1908] leaves the stored config unchanged and exits 1 when the write fails", async () => {
    const t = applyRuntime();
    const store = t.runtime.deps.store;
    store.putProjectConfig({ ...defaultProjectConfig("proj-gizmos"), baseBranch: "trunk" });
    const put = store.putProjectConfig.bind(store);
    store.putProjectConfig = (config) => {
      put(config);
      throw new Error("disk full");
    };
    const result = await apply(t, "--apply", "--project", "gizmos");
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Could not write");
    expect(result.stderr).toContain("disk full");
    expect(store.getProjectConfig("proj-gizmos")).toEqual({ ...defaultProjectConfig("proj-gizmos"), baseBranch: "trunk" });
  });
});

describe("bb factoryman dispatch", () => {
  const INIT_LINE = "Usage: bb factoryman dispatch init --provider <id> [--project <id>] [--model <id>] [--level <id>] [--mode <mode>]";

  function initRuntime() {
    const t = testRuntime();
    t.bb.checkouts.set("proj-1", "/work/repo");
    t.bb.models.set("claude", { models: [modelEntry("opus", { isDefault: true, defaultReasoningLevel: "high" })], loadError: null });
    return t;
  }

  it("[U1441] routes dispatch init to the init command", async () => {
    const t = initRuntime();
    const result = await runFactorymanCommand(t.runtime, ["dispatch", "init", "--provider", "claude", "--project", "proj-1"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Wrote /work/repo/.bb/factoryman/dispatch.json.");
    expect(t.files.writes).toEqual(["/work/repo/.bb/factoryman/dispatch.json"]);
  });

  it("[U1441] takes the project from the command context", async () => {
    const t = initRuntime();
    const result = await runFactorymanCommand(t.runtime, ["dispatch", "init", "--provider", "claude"], { projectId: "proj-1" });
    expect(result.exitCode).toBe(0);
  });

  it.each([[["dispatch"]], [["dispatch", "nope"]], [["dispatch", "--provider", "claude"]], [["dispatch", "--provider", "claude", "--project", "proj-1"]]])("[U1442] prints the usage and exits 2 for %j", async (argv) => {
    const t = initRuntime();
    const result = await runFactorymanCommand(t.runtime, argv);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain(INIT_LINE);
    expect(t.files.writes).toEqual([]);
  });

  it("[U1443] lists the init line in the usage text of the command", async () => {
    const t = initRuntime();
    expect((await runFactorymanCommand(t.runtime, ["nope"])).stderr).toContain(`${INIT_LINE}\n`);
  });
});
