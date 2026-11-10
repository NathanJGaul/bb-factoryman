import { check, type Lab, type Scenario } from "../port.ts";
import { hasAll, SUPERVISOR_TOOLS } from "./helpers.ts";

/**
 * S9: a supervisor that the plugin starts has its role from its first session, and one stamped late gets its tools and
 * skill by the documented step. The first-turn check is the one that proves the role is seeded at spawn (report task H4).
 */
export const s9: Scenario = {
  id: "S9",
  title: "Role change",
  tiers: ["1", "1.5"],
  async run(lab: Lab) {
    const start = await lab.startSupervisor("S9start");
    const checks = [check("S9.start-command", "`bb factoryman supervisor start` spawns a supervisor and names its thread", start.code === 0 && start.threadId !== null, `exit ${start.code}: ${start.text.slice(0, 200)}`)];
    const firstTurn = "A supervisor started with the command has its five tools and its skill on its first turn, and no worker tool or skill";
    if (start.threadId === null) {
      checks.push(check("S9.start-tools", firstTurn, false, "the start command made no thread to read"));
    } else {
      await lab.waitIdle(start.threadId, lab.patienceMs);
      const first = await lab.offers({ kind: "supervisor", label: "S9start" });
      const complete = hasAll(first.tools, SUPERVISOR_TOOLS) && first.skills.includes("factoryman-supervisor") && !first.tools.includes("factoryman_report") && !first.skills.includes("factoryman-worker");
      checks.push(check("S9.start-tools", firstTurn, complete, `tools: ${first.tools.join(", ") || "none"}; skills: ${first.skills.join(", ") || "none"}`));
    }
    const label = "S9late";
    const thread = await lab.spawnSupervisor(label);
    await lab.waitIdle(thread, lab.patienceMs);
    const before = await lab.offers({ kind: "supervisor", label });
    checks.push(check("S9.unstamped-no-tools", "A supervisor with no role is offered no factoryman tool and no factoryman skill", before.tools.length === 0 && before.skills.length === 0, `tools: ${before.tools.join(", ") || "none"}; skills: ${before.skills.join(", ") || "none"}`));
    const stamp = await lab.stamp(thread);
    const needsClear = lab.driver.roleChangeStep === "clear";
    checks.push(check("S9.stamp-advice", needsClear ? "The stamp command tells the person to clear the thread, because this harness needs it" : "The stamp command succeeds", stamp.code === 0 && (!needsClear || /bb thread clear/.test(stamp.text)), stamp.text.slice(0, 300)));
    if (needsClear) await lab.clear(thread);
    await lab.tell(thread, label, []);
    await lab.waitIdle(thread, lab.patienceMs);
    const after = await lab.offers({ kind: "supervisor", label });
    checks.push(check("S9.tools-after-step", `After the documented step (${lab.driver.roleChangeStep}) the supervisor has its five tools and its skill`, hasAll(after.tools, SUPERVISOR_TOOLS) && after.skills.includes("factoryman-supervisor"), `tools: ${after.tools.join(", ") || "none"}; skills: ${after.skills.join(", ") || "none"}`));
    return checks;
  },
};
