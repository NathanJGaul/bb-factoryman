import { check, type Check, type Lab, type Scenario } from "../port.ts";
import { dispatchFailure, wakesAfter } from "./helpers.ts";

/** S7: a model turn that fails fails the task, wakes the supervisor once, and keeps the cause in the evidence. */
export const s7: Scenario = {
  id: "S7",
  title: "Failure",
  tiers: ["1", "1.5"],
  async run(lab: Lab) {
    const { code } = lab.driver.failure;
    const out = await lab.dispatch("scout", "S7 failure probe", { flag: `fail=${code}` });
    if (out.taskId === null) return [dispatchFailure("S7.failed", "The task reaches failed", out.result.text)];
    const id = out.taskId;
    if (lab.driver.failure.mode === "ends-turn") return endsTurn(lab, id);
    const patience = lab.failurePatienceMs;
    const row = await lab.waitForState(id, ["failed"], patience);
    const wakes = await wakesAfter(lab, await lab.parentOf(id), id, /failed/, patience);
    const fail = (await lab.events(id)).find((e) => e.event === "fail" && e.outcome === "applied");
    const cause = `CONFORMANCE-CAUSE-${code}`;
    return [
      check("S7.failed", "The task reaches failed with evidence", row?.state === "failed" && (fail?.evidence ?? "").trim() !== "", `state: ${row?.state ?? "none within the wait"}`),
      check("S7.wake", "The supervisor is woken exactly once about the failure", wakes.length === 1, `${wakes.length} wake(s)`),
      check("S7.cause", `The failure evidence holds the harness's cause text (${cause})`, (fail?.evidence ?? "").includes(cause), `evidence: ${(fail?.evidence ?? "none").slice(0, 300)}`),
    ];
  },
};

/**
 * A harness that ends a failing turn normally (omp) shows the model error as the assistant's text and records no failure.
 * The plugin then sees a silent turn: the task stays working and the supervisor gets one wake that says so.
 */
async function endsTurn(lab: Lab, id: string): Promise<Check[]> {
  const wakes = await wakesAfter(lab, await lab.parentOf(id), id, /without reporting/, lab.failurePatienceMs);
  const row = (await lab.tasks()).find((t) => t.taskId === id);
  return [
    {
      ...check("S7.ends-quiet", "The task stays working and the supervisor gets exactly one wake that says the turn ended without a report", row?.state === "working" && wakes.length === 1, `state ${row?.state ?? "none"}; ${wakes.length} wake(s)`),
      note: "This harness ends a failing model turn normally and shows the error as the assistant's text, so bb records no failure and the plugin sees a silent turn.",
    },
  ];
}
