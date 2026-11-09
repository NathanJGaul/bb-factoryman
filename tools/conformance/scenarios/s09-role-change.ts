import { check, type Lab, type Scenario } from "../port.ts";
import { hasAll, SUPERVISOR_TOOLS } from "./helpers.ts";

/** S9: a supervisor that has the role from the start, and one stamped late, get their tools and skill by the documented step. */
export const s9: Scenario = {
  id: "S9",
  title: "Role change",
  tiers: ["1", "1.5"],
  async run(lab: Lab) {
    const start = await lab.startSupervisor("S9start");
    const checks = [check("S9.start-command", "`bb factoryman supervisor start` spawns a supervisor with its role", start.code === 0, `exit ${start.code}: ${start.text.slice(0, 200)}`)];
    const label = "S9late";
    const thread = await lab.spawnSupervisor(label);
    await lab.waitIdle(thread, lab.patienceMs);
    const before = await lab.offers({ kind: "supervisor", label });
    checks.push(check("S9.unstamped-no-tools", "A supervisor with no role is offered no factoryman tool and no factoryman skill", before.tools.length === 0 && before.skills.length === 0, `tools: ${before.tools.join(", ") || "none"}; skills: ${before.skills.join(", ") || "none"}`));
    const stamp = await lab.stamp(thread);
    const needsClear = lab.driver.roleChangeStep === "clear";
    checks.push(check("S9.stamp-advice", needsClear ? "The stamp command tells the person to clear the thread, because this harness needs it" : "The stamp needs no advice on this harness", stamp.code === 0 && (!needsClear || /clear/i.test(stamp.text)), stamp.text.slice(0, 300)));
    if (needsClear) await lab.clear(thread);
    await lab.tell(thread, label, []);
    await lab.waitIdle(thread, lab.patienceMs);
    const after = await lab.offers({ kind: "supervisor", label });
    checks.push(check("S9.tools-after-step", `After the documented step (${lab.driver.roleChangeStep}) the supervisor has its four tools and its skill`, hasAll(after.tools, SUPERVISOR_TOOLS) && after.skills.includes("factoryman-supervisor"), `tools: ${after.tools.join(", ") || "none"}; skills: ${after.skills.join(", ") || "none"}`));
    return checks;
  },
};
