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
const okIds = (checks: Check[]) => checks.filter((c) => c.ok).map((c) => c.id).sort();
const failedIds = (checks: Check[]) => checks.filter((c) => !c.ok).map((c) => c.id).sort();
const expectAllOk = (checks: Check[], ids: string[]) => {
  expect(checks.map((c) => c.id).sort()).toEqual([...ids].sort());
  expect(failedIds(checks), checks.filter((c) => !c.ok).map((c) => `${c.id}: ${c.evidence}`).join("; ")).toEqual([]);
};

describe("S1 readiness", () => {
  it("[U1381] passes when the provider under test is ready, blocks a provider that is not ready, and names its status", async () => {
    expectAllOk(await run("S1"), ["S1.ready", "S1.unready-blocks", "S1.remedy"]);
    expect(failedIds(await run("S1", { providerNotReady: true }))).toContain("S1.ready");
  });
  it("[U1382] fails when a provider that is not ready creates a task, and when the refusal names no remedy", async () => {
    const open = await run("S1", { noReadinessGate: true });
    expect(failedIds(open)).toEqual(["S1.remedy", "S1.unready-blocks"]);
    expect(failedIds(await run("S1", { noRemedy: true }))).toEqual(["S1.remedy"]);
  });
});

describe("S2 profile honored", () => {
  it("[U1383] passes when the thread row shows the requested profile and an unsupported profile blocks with no task", async () => {
    for (const harness of ["pi", "claude-code", "codex", "omp"]) expectAllOk(await run("S2", {}, harness), ["S2.thread-profile", "S2.unsupported-blocks"]);
    expectAllOk(await run("S2", {}, "stub", "1"), ["S2.thread-profile", "S2.unsupported-blocks"]);
  });
  it("[U1384] fails when the thread row differs, and when the unsupported profile creates a task", async () => {
    expect(failedIds(await run("S2", { wrongModel: true }))).toEqual(["S2.thread-profile"]);
    expect(failedIds(await run("S2", { noProfileGate: true }))).toEqual(["S2.unsupported-blocks"]);
  });
});

describe("S3 scout", () => {
  it("[U1385] passes when the task goes queued, working, report_ready with evidence and the supervisor is woken once", async () => {
    expectAllOk(await run("S3"), ["S3.states", "S3.evidence", "S3.wake"]);
  });
  it("[U1386] fails on a missing state, empty evidence, no wake, or two wakes", async () => {
    expect(failedIds(await run("S3", { neverReports: true }))).toEqual(expect.arrayContaining(["S3.states"]));
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
    expect(failedIds(await run("S4", { neverReports: true }))).toContain("S4.review-ready");
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
  });
});

describe("S6 silence", () => {
  it("[U1391] passes when a silent turn leaves the task working and wakes the supervisor once", async () => {
    expectAllOk(await run("S6"), ["S6.stays-working", "S6.one-wake"]);
  });
  it("[U1392] fails when the supervisor is not woken, is woken twice, or the task changes state", async () => {
    expect(failedIds(await run("S6", { noWake: true }))).toEqual(["S6.one-wake"]);
    expect(failedIds(await run("S6", { doubleWake: true }))).toEqual(["S6.one-wake"]);
  });
});

describe("S7 failure", () => {
  it("[U1393] passes when a failing turn fails the task, wakes once, and the evidence holds the cause", async () => {
    expectAllOk(await run("S7"), ["S7.failed", "S7.wake", "S7.cause"]);
    expect(failedIds(await run("S7", { noCause: true }))).toEqual(["S7.cause"]);
  });
  it("[U1394] fails when the task does not reach failed or no wake arrives", async () => {
    expect(failedIds(await run("S7", { neverReports: true }))).toContain("S7.failed");
    expect(failedIds(await run("S7", { noWake: true }))).toEqual(["S7.wake"]);
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
  it("[U1397] passes when a late-stamped supervisor has its tools and skill after the driver's step, and the start command exists", async () => {
    for (const harness of ["pi", "codex"]) expectAllOk(await run("S9", {}, harness), ["S9.start-command", "S9.unstamped-no-tools", "S9.stamp-advice", "S9.tools-after-step"]);
  });
  it("[U1398] fails when the supervisor lacks the tools after the step, and keeps the start command and advice checks separate", async () => {
    expect(failedIds(await run("S9", { stampNeverArrives: true }))).toEqual(["S9.tools-after-step"]);
    expect(failedIds(await run("S9", { noStartCommand: true }))).toEqual(["S9.start-command"]);
    expect(failedIds(await run("S9", { noClearAdvice: true }, "codex"))).toEqual(["S9.stamp-advice"]);
  });
});

describe("S10 restart", () => {
  it("[U1399] passes when a plugin reload keeps every task and state and adds no event", async () => {
    expectAllOk(await run("S10", {}, "stub", "1"), ["S10.state-kept", "S10.no-new-events"]);
  });
  it("[U1400] fails when a reload adds a reconcile event", async () => {
    expect(failedIds(await run("S10", { reloadAddsEvent: true }, "stub", "1"))).toEqual(["S10.no-new-events"]);
  });
});

describe("S11 teardown", () => {
  it("[U1401] passes when a dirty worktree is refused and logged, a clean one is removed, and no process is left", async () => {
    expectAllOk(await run("S11"), ["S11.dirty-refused", "S11.dirty-kept", "S11.clean-removed", "S11.no-process-left"]);
  });
  it("[U1402] fails when a dirty worktree is torn down or a process is left", async () => {
    expect(okIds(await run("S11", { teardownIgnoresDirt: true }))).not.toContain("S11.dirty-refused");
    expect(failedIds(await run("S11", { processLeft: true }))).toEqual(["S11.no-process-left"]);
  });
});

describe("S12 wake while busy", () => {
  it("[U1403] passes when a wake sent while the supervisor is busy arrives exactly once", async () => {
    expectAllOk(await run("S12"), ["S12.delivered", "S12.once", "S12.mid-turn"]);
  });
  it("[U1404] fails when the wake is lost or arrives twice, or the supervisor was not busy", async () => {
    expect(failedIds(await run("S12", { busyWakeLost: true }))).toEqual(expect.arrayContaining(["S12.delivered"]));
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
