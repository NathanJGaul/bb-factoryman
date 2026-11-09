import { check, type Lab, type Scenario } from "../port.ts";
import { dispatchFailure, wakesAfter } from "./helpers.ts";

/** S4: a ship task in local-only mode leaves its commit on the task branch and reaches review_ready. */
export const s4: Scenario = {
  id: "S4",
  title: "Ship in local-only mode",
  tiers: ["1", "1.5"],
  async run(lab: Lab) {
    const out = await lab.dispatch("ship", "S4 ship probe");
    if (out.taskId === null) return [dispatchFailure("S4.review-ready", "The task reaches review_ready", out.result.text)];
    const id = out.taskId;
    const row = await lab.waitForState(id, ["review_ready", "failed", "blocked"], lab.patienceMs);
    const count = await lab.sh(`git -C ${lab.clone} rev-list --count main..fm/${id}`);
    const commits = Number(count.stdout.trim());
    const wakes = await wakesAfter(lab, await lab.parentOf(id), id, /review_ready/);
    return [
      check("S4.branch-commit", "The task branch holds the one commit the worker made", count.code === 0 && commits === 1, `git rev-list --count main..fm/${id}: ${count.stdout.trim() || `exit ${count.code}`}`),
      check("S4.review-ready", "The task reaches review_ready", row?.state === "review_ready", `state: ${row?.state ?? "none within the wait"}`),
      check("S4.wake", "The supervisor is woken exactly once about review_ready", wakes.length === 1, `${wakes.length} wake(s)`),
    ];
  },
};
