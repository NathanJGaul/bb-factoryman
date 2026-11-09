import { check, type Lab, type Scenario } from "../port.ts";
import { dispatchFailure, sleep } from "./helpers.ts";

/** S10: reloading the plugin with a task running keeps every task and state, and adds no event. */
export const s10: Scenario = {
  id: "S10",
  title: "Restart",
  tiers: ["1"],
  async run(lab: Lab) {
    const out = await lab.dispatch("scout", "S10 restart probe", { flag: "hold" });
    if (out.taskId === null) return [dispatchFailure("S10.state-kept", "A reload keeps every task and state", out.result.text)];
    await lab.waitForState(out.taskId, ["working"], lab.patienceMs);
    const tasksBefore = (await lab.tasks()).map((t) => `${t.taskId}:${t.state}`).sort();
    const eventsBefore = (await lab.events()).length;
    await lab.reloadPlugin();
    await sleep(lab.settleMs);
    const tasksAfter = (await lab.tasks()).map((t) => `${t.taskId}:${t.state}`).sort();
    const eventsAfter = await lab.events();
    const added = eventsAfter.slice(eventsBefore);
    return [
      check("S10.state-kept", "Every task keeps its state across a reload", tasksBefore.join(",") === tasksAfter.join(","), `before: ${tasksBefore.join(", ")}; after: ${tasksAfter.join(", ")}`),
      check("S10.no-new-events", "A reload adds no event to the log", added.length === 0, added.length === 0 ? `${eventsBefore} events before and after` : `added: ${added.map((e) => `${e.event} (${e.taskId})`).join(", ")}`),
    ];
  },
};
