import { check, type Lab, type Scenario } from "../port.ts";
import { dispatchFailure, wakesAfter } from "./helpers.ts";

/** S6: a turn that ends with no report leaves the task working and wakes the supervisor once. */
export const s6: Scenario = {
  id: "S6",
  title: "Silence",
  tiers: ["1", "1.5"],
  async run(lab: Lab) {
    const out = await lab.dispatch("scout", "S6 silent probe", { flag: "silent" });
    if (out.taskId === null) return [dispatchFailure("S6.one-wake", "One wake says the worker finished a turn without reporting", out.result.text)];
    const id = out.taskId;
    const wakes = await wakesAfter(lab, await lab.parentOf(id), id, /without reporting/);
    const row = (await lab.tasks()).find((t) => t.taskId === id);
    const moved = (await lab.events(id)).filter((e) => e.outcome === "applied" && e.toState !== null && !["queued", "working"].includes(e.toState));
    return [
      check("S6.stays-working", "The task stays working and no report event is recorded", row?.state === "working" && moved.length === 0, `state: ${row?.state ?? "unknown"}; later transitions: ${moved.map((e) => e.event).join(", ") || "none"}`),
      check("S6.one-wake", "The supervisor gets exactly one wake that says the turn ended without a report", wakes.length === 1, `${wakes.length} wake(s)`),
    ];
  },
};
