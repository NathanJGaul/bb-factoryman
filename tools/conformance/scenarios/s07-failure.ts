import { check, type Lab, type Scenario } from "../port.ts";
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
