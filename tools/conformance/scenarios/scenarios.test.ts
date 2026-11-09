import { describe, expect, it } from "vitest";
import { FakeLab, type Faults } from "../../../test/fixtures/conformance-lab.ts";
import type { Check, Scenario } from "../port.ts";
import { SCENARIOS, scenariosFor } from "./index.ts";

const byId = (id: string): Scenario => {
  const found = SCENARIOS.find((s) => s.id === id);
  if (found === undefined) throw new Error(`no scenario ${id}`);
  return found;
};
async function run(id: string, faults: Faults = {}, harness = "pi", tier: "1" | "1.5" = "1.5"): Promise<Check[]> {
  return byId(id).run(new FakeLab(harness, faults, tier));
}
const failedIds = (checks: Check[]) => checks.filter((c) => !c.ok).map((c) => c.id).sort();
const expectAllOk = (checks: Check[], ids: string[]) => {
  expect(checks.map((c) => c.id).sort()).toEqual([...ids].sort());
  expect(failedIds(checks), checks.filter((c) => !c.ok).map((c) => `${c.id}: ${c.evidence}`).join("; ")).toEqual([]);
};

describe("S1 readiness", () => {
  it("[U1381] passes when the provider under test is ready, blocks a provider that is not ready, and names its status", async () => {
    expectAllOk(await run("S1"), ["S1.ready", "S1.unready-blocks", "S1.remedy"]);
    expect(failedIds(await run("S1", { providerNotReady: true }))).toEqual(["S1.ready"]);
  });
  it("[U1382] fails when a provider that is not ready creates a task, and when the refusal names no remedy", async () => {
    const open = await run("S1", { noReadinessGate: true });
    expect(failedIds(open)).toEqual(["S1.remedy", "S1.unready-blocks"]);
    expect(failedIds(await run("S1", { noRemedy: true }))).toEqual(["S1.remedy"]);
    // With no provider to probe, S1 must not pass on S1.ready alone: it fails closed.
    expect(failedIds(await run("S1", { allProvidersReady: true }))).toEqual(["S1.unready-blocks"]);
  });
});

describe("S2 profile honored", () => {
  it("[U1383] passes when the thread row shows the requested profile and an unsupported profile blocks with no task", async () => {
    for (const harness of ["pi", "claude-code", "codex", "omp"]) expectAllOk(await run("S2", {}, harness), ["S2.thread-profile", "S2.unsupported-blocks"]);
    expectAllOk(await run("S2", {}, "stub", "1"), ["S2.thread-profile", "S2.unsupported-blocks"]);
  });
  it("[U1384] fails when the thread row differs, and when the unsupported profile creates a task", async () => {
    for (const fault of ["wrongModel", "wrongLevel", "wrongMode", "wrongProvider"] as const) expect(failedIds(await run("S2", { [fault]: true })), fault).toEqual(["S2.thread-profile"]);
    expect(failedIds(await run("S2", { noProfileGate: true }))).toEqual(["S2.unsupported-blocks"]);
  });
});

describe("S3 scout", () => {
  it("[U1385] passes when the task goes queued, working, report_ready with evidence and the supervisor is woken once", async () => {
    expectAllOk(await run("S3"), ["S3.states", "S3.evidence", "S3.wake"]);
  });
  it("[U1386] fails on a missing state, empty evidence, no wake, or two wakes", async () => {
    expect(failedIds(await run("S3", { neverReports: true }))).toEqual(["S3.evidence", "S3.states", "S3.wake"]);
    expect(failedIds(await run("S3", { emptyEvidence: true }))).toEqual(["S3.evidence"]);
    expect(failedIds(await run("S3", { noWake: true }))).toEqual(["S3.wake"]);
    expect(failedIds(await run("S3", { doubleWake: true }))).toEqual(["S3.wake"]);
  });
});

describe("S4 ship", () => {
  it("[U1387] passes when the branch holds the commit and the task is review_ready", async () => {
    expectAllOk(await run("S4"), ["S4.branch-commit", "S4.review-ready", "S4.wake"]);
  });
  it("[U1388] fails when the branch has no commit or the task never gets ready", async () => {
    expect(failedIds(await run("S4", { noCommit: true }))).toEqual(["S4.branch-commit"]);
    expect(failedIds(await run("S4", { neverReports: true }))).toEqual(["S4.branch-commit", "S4.review-ready", "S4.wake"]);
    expect(failedIds(await run("S4", { noWake: true }))).toEqual(["S4.wake"]);
  });
});

describe("S4 ship in each delivery mode", () => {
  const S4_IDS = ["S4.branch-commit", "S4.review-ready", "S4.wake"];
  const PR = "https://github.com/conformance/lab/pull/1";

  it("[U1509] in local-only mode dispatches no pull request, passes, and sets no note", async () => {
    const lab = new FakeLab("codex");
    const checks = await byId("S4").run(lab);
    expectAllOk(checks, S4_IDS);
    expect(checks.filter((c) => c.note !== undefined)).toEqual([]);
    expect((await lab.tasks())[0]).toMatchObject({ mode: "local-only", pullRequestUrl: null });
  });

  it("[U1510] in direct-PR mode makes the worker report a pull request, passes, and names the mode in a note on S4.review-ready", async () => {
    const lab = new FakeLab("pi");
    const checks = await byId("S4").run(lab);
    expectAllOk(checks, S4_IDS);
    expect(checks.find((c) => c.id === "S4.review-ready")?.note).toBe("This harness ran in direct-PR mode, because the plugin does not admit it in local-only mode.");
    expect(checks.filter((c) => c.note !== undefined)).toHaveLength(1);
    expect((await lab.tasks())[0]).toMatchObject({ mode: "direct-PR", state: "review_ready", pullRequestUrl: PR });
  });

  it("[U1511] in direct-PR mode fails S4.review-ready when the worker reports no pull request", async () => {
    expect(failedIds(await run("S4", { noPullRequest: true }, "pi"))).toEqual(["S4.review-ready", "S4.wake"]);
  });

  it("[U1512] in no-mistakes mode fails S4.review-ready, says S4 does not run in that mode, and dispatches nothing", async () => {
    const lab = new FakeLab("codex", {}, "1.5", { deliveryMode: "no-mistakes" });
    const checks = await byId("S4").run(lab);
    expect(failedIds(checks)).toEqual(["S4.review-ready"]);
    expect(checks[0]?.evidence).toMatch(/no-mistakes/);
    expect(checks[0]?.evidence).toMatch(/does not run/);
    expect(lab.calls.filter((call) => call.startsWith("dispatch "))).toEqual([]);
  });

  it("[U1513] is titled Ship and names no delivery mode", () => {
    expect(byId("S4").title).toBe("Ship");
  });
});

describe("S5 confinement", () => {
  it("[U1389] passes when the worker is offered the report tool and its skill only, and the supervisor its four tools and skill only", async () => {
    expectAllOk(await run("S5"), ["S5.worker-tools", "S5.worker-skills", "S5.supervisor-tools", "S5.supervisor-skills"]);
    expectAllOk(await run("S5", {}, "codex"), ["S5.worker-tools", "S5.worker-skills", "S5.supervisor-tools", "S5.supervisor-skills"]);
  });
  it("[U1390] fails when a role is offered a tool or skill of the other role", async () => {
    expect(failedIds(await run("S5", { workerSeesSupervisorTools: true }))).toEqual(["S5.worker-tools"]);
    expect(failedIds(await run("S5", { supervisorSeesWorkerSkill: true }))).toEqual(["S5.supervisor-skills"]);
    expect(failedIds(await run("S5", { stampNeverArrives: true }))).toEqual(["S5.supervisor-skills", "S5.supervisor-tools"]);
    expect(failedIds(await run("S5", { workerSeesSupervisorSkill: true }))).toEqual(["S5.worker-skills"]);
  });
});

describe("S6 silence", () => {
  it("[U1391] passes when a silent turn leaves the task working and wakes the supervisor once", async () => {
    expectAllOk(await run("S6"), ["S6.stays-working", "S6.one-wake"]);
  });
  it("[U1392] fails when the supervisor is not woken, is woken twice, or the task changes state", async () => {
    expect(failedIds(await run("S6", { noWake: true }))).toEqual(["S6.one-wake"]);
    expect(failedIds(await run("S6", { doubleWake: true }))).toEqual(["S6.one-wake"]);
    expect(failedIds(await run("S6", { silentMoves: true }))).toEqual(["S6.stays-working"]);
  });
});

describe("S7 failure", () => {
  it("[U1393] passes when a failing turn fails the task, wakes once, and the evidence holds the cause", async () => {
    expectAllOk(await run("S7"), ["S7.failed", "S7.wake", "S7.cause"]);
    expect(failedIds(await run("S7", { noCause: true }))).toEqual(["S7.cause"]);
  });
  it("[U1394] fails when the task does not reach failed or no wake arrives", async () => {
    expect(failedIds(await run("S7", { neverReports: true }))).toEqual(["S7.cause", "S7.failed", "S7.wake"]);
    expect(failedIds(await run("S7", { noWake: true }))).toEqual(["S7.wake"]);
  });
});

describe("S7 failure on a harness that ends the turn normally", () => {
  it("[U1424] passes when the task stays working and the supervisor gets one silent-turn wake, and fails when it is not told", async () => {
    const ok = await run("S7", {}, "omp");
    expect(ok.map((c) => c.id)).toEqual(["S7.ends-quiet"]);
    expect(failedIds(ok)).toEqual([]);
    expect(ok[0]?.note).toMatch(/ends a failing model turn normally/);
    expect(failedIds(await run("S7", { noWake: true }, "omp"))).toEqual(["S7.ends-quiet"]);
    expect(failedIds(await run("S7", { doubleWake: true }, "omp"))).toEqual(["S7.ends-quiet"]);
  });
});

describe("S8 refusals", () => {
  it("[U1395] passes when an empty report, a second report, and a wrong-state teardown are each refused and logged", async () => {
    expectAllOk(await run("S8"), ["S8.empty-evidence-refused", "S8.wrong-state-refused", "S8.teardown-wrong-state"]);
  });
  it("[U1396] fails when a refusal is not logged or an empty report is accepted", async () => {
    expect(failedIds(await run("S8", { silentRefusals: true }))).toEqual(["S8.empty-evidence-refused", "S8.teardown-wrong-state", "S8.wrong-state-refused"]);
    expect(failedIds(await run("S8", { acceptEmpty: true }))).toEqual(["S8.empty-evidence-refused"]);
  });
});

describe("S9 role change", () => {
  const ALL = ["S9.start-command", "S9.start-tools", "S9.unstamped-no-tools", "S9.stamp-advice", "S9.tools-after-step"];

  it("[U1711] passes for the stub and the four harness drivers when a started supervisor has its tools and skill on its first turn and a late stamp reaches them by the driver's step", async () => {
    for (const harness of ["pi", "claude-code", "codex", "omp"]) expectAllOk(await run("S9", {}, harness), ALL);
    expectAllOk(await run("S9", {}, "stub", "1"), ALL);
  });

  it("[U1712] fails the start checks when the start command does not exist, because there is no thread to read", async () => {
    expect(failedIds(await run("S9", { noStartCommand: true }))).toEqual(["S9.start-command", "S9.start-tools"]);
  });

  it("[U1713] fails S9.start-tools when the started supervisor lacks a tool or the skill, is offered a worker tool, or gets its tools only after a clear", async () => {
    for (const fault of ["startedLacksTool", "startedLacksSkill", "startedSeesWorkerTool", "startedNeedsClear"] as const) {
      expect(failedIds(await run("S9", { [fault]: true })), fault).toEqual(["S9.start-tools"]);
    }
  });

  it("[U1714] fails S9.unstamped-no-tools when a thread with no role is offered a factoryman tool", async () => {
    expect(failedIds(await run("S9", { unstampedHasTools: true }))).toEqual(["S9.unstamped-no-tools"]);
  });

  it("[U1715] fails S9.stamp-advice when a harness whose step is a clear gets no clear advice, and when the stamp command fails", async () => {
    for (const harness of ["codex", "omp"]) expect(failedIds(await run("S9", { noClearAdvice: true }, harness)), harness).toEqual(["S9.stamp-advice"]);
    expect(failedIds(await run("S9", { stampFails: true }))).toEqual(["S9.stamp-advice", "S9.tools-after-step"]);
  });

  it("[U1716] fails S9.tools-after-step when the late stamp never arrives, and only that check", async () => {
    expect(failedIds(await run("S9", { stampNeverArrives: true }))).toEqual(["S9.tools-after-step"]);
  });
});

describe("S10 restart", () => {
  it("[U1399] passes when a plugin reload keeps every task and state and adds no event", async () => {
    expectAllOk(await run("S10", {}, "stub", "1"), ["S10.state-kept", "S10.no-new-events"]);
  });
  it("[U1400] fails when a reload adds a reconcile event", async () => {
    expect(failedIds(await run("S10", { reloadAddsEvent: true }, "stub", "1"))).toEqual(["S10.no-new-events"]);
    expect(failedIds(await run("S10", { reloadChangesState: true }, "stub", "1"))).toEqual(["S10.state-kept"]);
  });
});

describe("S11 teardown", () => {
  it("[U1401] passes when a dirty worktree is refused and logged, a clean one is removed, and no process is left", async () => {
    expectAllOk(await run("S11"), ["S11.dirty-refused", "S11.dirty-kept", "S11.clean-removed", "S11.no-process-left"]);
  });
  it("[U1402] fails when a dirty worktree is torn down or a process is left", async () => {
    expect(failedIds(await run("S11", { teardownIgnoresDirt: true }))).toEqual(["S11.clean-removed", "S11.dirty-kept", "S11.dirty-refused"]);
    expect(failedIds(await run("S11", { worktreeStaysAfterTeardown: true }))).toEqual(["S11.clean-removed"]);
    expect(failedIds(await run("S11", { processLeft: true }))).toEqual(["S11.no-process-left"]);
  });
});

describe("S12 wake while busy", () => {
  it("[U1403] passes when a wake sent while the supervisor is busy arrives exactly once", async () => {
    expectAllOk(await run("S12"), ["S12.delivered", "S12.once", "S12.mid-turn"]);
  });
  it("[U1404] fails when the wake is lost or arrives twice, or the supervisor was not busy", async () => {
    expect(failedIds(await run("S12", { busyWakeLost: true }))).toEqual(["S12.delivered", "S12.mid-turn", "S12.once"]);
    expect(failedIds(await run("S12", { doubleWake: true }))).toEqual(["S12.once"]);
    expect(failedIds(await run("S12", { wakeAfterTurn: true }))).toEqual(["S12.mid-turn"]);
  });
});

describe("the registry", () => {
  it("[U1405] holds S1 to S12 in order, tier 1 runs all twelve, and tier 1.5 runs S1 to S9, S11, and S12", () => {
    expect(SCENARIOS.map((s) => s.id)).toEqual(["S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8", "S9", "S10", "S11", "S12"]);
    expect(scenariosFor("1", null).map((s) => s.id)).toEqual(SCENARIOS.map((s) => s.id));
    expect(scenariosFor("1.5", null).map((s) => s.id)).toEqual(["S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8", "S9", "S11", "S12"]);
    expect(scenariosFor("1", ["S4", "S3"]).map((s) => s.id)).toEqual(["S3", "S4"]);
  });
});
