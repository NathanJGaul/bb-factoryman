import { deliveryModeOf } from "../drivers/types.ts";
import { check, type Lab, type Scenario } from "../port.ts";
import { dispatchFailure, wakesAfter } from "./helpers.ts";

/** The pull request that a scripted worker reports in `direct-PR` mode. No forge sees it: the plugin checks that the URL is present and valid. */
const PULL_REQUEST = "https://github.com/conformance/lab/pull/1";

/**
 * S4: a ship task leaves its commit on the task branch and reaches review_ready, in the delivery mode of the driver's lab project.
 * `local-only` is the default. A harness that the plugin refuses there (Pi) runs in `direct-PR`, where review ready needs an open pull request.
 */
export const s4: Scenario = {
  id: "S4",
  title: "Ship",
  tiers: ["1", "1.5"],
  async run(lab: Lab) {
    const mode = deliveryModeOf(lab.driver);
    if (mode === "no-mistakes") {
      return [check("S4.review-ready", "The task reaches review_ready", false, "S4 does not run in no-mistakes mode: review ready there comes from the validator, which the lab does not run.")];
    }
    const out = await lab.dispatch("ship", "S4 ship probe", mode === "direct-PR" ? { flag: `pr=${PULL_REQUEST}` } : {});
    if (out.taskId === null) return [dispatchFailure("S4.review-ready", "The task reaches review_ready", out.result.text)];
    const id = out.taskId;
    const row = await lab.waitForState(id, ["review_ready", "failed", "blocked"], lab.patienceMs);
    const count = await lab.sh(`git -C ${lab.clone} rev-list --count main..fm/${id}`);
    const commits = Number(count.stdout.trim());
    const wakes = await wakesAfter(lab, await lab.parentOf(id), id, /review_ready/);
    const ready = check("S4.review-ready", "The task reaches review_ready", row?.state === "review_ready", `state: ${row?.state ?? "none within the wait"}`);
    return [
      check("S4.branch-commit", "The task branch holds the one commit the worker made", count.code === 0 && commits === 1, `git rev-list --count main..fm/${id}: ${count.stdout.trim() || `exit ${count.code}`}`),
      mode === "local-only" ? ready : { ...ready, note: `This harness ran in ${mode} mode, because the plugin does not admit it in local-only mode.` },
      check("S4.wake", "The supervisor is woken exactly once about review_ready", wakes.length === 1, `${wakes.length} wake(s)`),
    ];
  },
};
