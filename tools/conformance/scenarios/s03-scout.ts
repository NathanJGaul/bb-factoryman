import { check, type Lab, type Scenario } from "../port.ts";
import { dispatchFailure, inOrder, wakesAfter } from "./helpers.ts";

/** S3: a scout goes queued, working, report_ready, keeps its evidence, and wakes the supervisor once. */
export const s3: Scenario = {
  id: "S3",
  title: "Scout",
  tiers: ["1", "1.5"],
  async run(lab: Lab) {
    const out = await lab.dispatch("scout", "S3 scout probe");
    if (out.taskId === null) return [dispatchFailure("S3.states", "The task goes queued, working, report_ready", out.result.text)];
    const id = out.taskId;
    await lab.waitForState(id, ["report_ready", "failed"], lab.patienceMs);
    const applied = (await lab.events(id)).filter((e) => e.outcome === "applied");
    const states = applied.flatMap((e) => (e.toState === null ? [] : [e.toState]));
    const report = applied.find((e) => e.event === "report");
    const wakes = await wakesAfter(lab, await lab.parentOf(id), id, /report_ready/);
    return [
      check("S3.states", "The task goes queued, working, report_ready", inOrder(states, ["queued", "working", "report_ready"]), `states: ${states.join(", ")}`),
      check("S3.evidence", "The report event keeps non-empty evidence", (report?.evidence ?? "").trim() !== "", `evidence length ${(report?.evidence ?? "").length}`),
      check("S3.wake", "The supervisor is woken exactly once about report_ready", wakes.length === 1, `${wakes.length} wake(s)`),
    ];
  },
};
