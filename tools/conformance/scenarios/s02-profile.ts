import { check, type Lab, type Scenario } from "../port.ts";
import { dispatchFailure } from "./helpers.ts";

/** S2: the thread row shows the profile that was asked for, and a profile the provider cannot take is refused before anything spawns. */
export const s2: Scenario = {
  id: "S2",
  title: "Profile honored",
  tiers: ["1", "1.5"],
  async run(lab: Lab) {
    const { profile } = lab.driver;
    const checks = [];
    const out = await lab.dispatch("scout", "S2 profile probe");
    if (out.taskId === null) {
      checks.push(dispatchFailure("S2.thread-profile", "The thread row shows the requested profile", out.result.text));
    } else {
      const task = (await lab.tasks()).find((t) => t.taskId === out.taskId);
      const facts = task?.workerThreadId == null ? null : await lab.thread(task.workerThreadId);
      const diffs = facts === null ? ["the task has no worker thread"] : (
        [["provider", facts.providerId, profile.provider], ["model", facts.model, profile.model], ["reasoning level", facts.reasoningLevel, profile.reasoningLevel], ["permission mode", facts.permissionMode, profile.permissionMode]] as const
      ).flatMap(([name, got, want]) => (got === want ? [] : [`${name}: asked ${want}, bb has ${got}`]));
      checks.push(check("S2.thread-profile", "The thread row shows the requested provider, model, level, and mode", diffs.length === 0, diffs.length === 0 ? `${profile.provider} ${profile.model} ${profile.reasoningLevel} ${profile.permissionMode}` : diffs.join("; ")));
    }
    const before = (await lab.tasks()).length;
    const bad = await lab.dispatch("scout", "S2 unsupported profile probe", { profile: lab.driver.unsupportedProfile });
    const after = (await lab.tasks()).length;
    checks.push(check("S2.unsupported-blocks", "A profile the provider cannot take is blocked and creates no task", bad.taskId === null && bad.result.isError && after === before, `task created: ${bad.taskId ?? "none"}; text: ${bad.result.text.slice(0, 200)}`));
    return checks;
  },
};
