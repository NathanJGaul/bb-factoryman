import { check, type Lab, type Scenario } from "../port.ts";
import { matching, sleep, supervisorWithRole, until } from "./helpers.ts";

/** How long the supervisor keeps its turn open. A harness worker needs to report inside this time. */
const BUSY_MS = 45_000;

/** S12: a wake that reaches a busy supervisor arrives exactly once. */
export const s12: Scenario = {
  id: "S12",
  title: "Wake while busy",
  tiers: ["1", "1.5"],
  async run(lab: Lab) {
    const label = "S12";
    const { threadId } = await supervisorWithRole(lab, label);
    const known = new Set((await lab.tasks()).map((t) => t.taskId));
    const dispatch = JSON.stringify({ kind: "scout", description: "S12 busy probe", profile: lab.driver.profile });
    // The supervisor dispatches, then keeps its turn open, so the worker's report arrives while it is busy.
    await lab.tell(threadId, label, [`CALL factoryman_dispatch ${dispatch}`, `SLEEP ${BUSY_MS}`], { wait: false });
    const task = await until(lab, async () => (await lab.tasks()).find((t) => !known.has(t.taskId)) ?? null);
    if (task !== null) await lab.waitForState(task.taskId, ["report_ready", "failed"], lab.patienceMs);
    await lab.waitIdle(threadId, lab.patienceMs + 30_000);
    await sleep(lab.settleMs);
    const wakes = task === null ? [] : matching(await lab.wakes(threadId), task.taskId, /report_ready/);
    return [
      check("S12.delivered", "The wake arrives", wakes.length >= 1, `${wakes.length} wake(s) for ${task?.taskId ?? "no task"}`),
      check("S12.once", "The wake arrives exactly once", wakes.length === 1, `${wakes.length} wake(s)`),
      check("S12.mid-turn", "The wake was sent while the supervisor was busy", wakes[0]?.busy === true, wakes[0] === undefined ? "no wake" : `busy at arrival: ${wakes[0].busy}`),
    ];
  },
};
