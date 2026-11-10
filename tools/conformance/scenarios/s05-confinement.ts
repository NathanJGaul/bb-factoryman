import { check, type Lab, type Scenario } from "../port.ts";
import { dispatchFailure, hasAll, hasAny, supervisorWithRole, SUPERVISOR_TOOLS } from "./helpers.ts";

/** S5: a worker sees the report tool and its own skill only. A supervisor sees its five tools and its own skill only. */
export const s5: Scenario = {
  id: "S5",
  title: "Confinement",
  tiers: ["1", "1.5"],
  async run(lab: Lab) {
    const out = await lab.dispatch("scout", "S5 confinement probe");
    if (out.taskId === null) return [dispatchFailure("S5.worker-tools", "The worker is offered the report tool only", out.result.text)];
    await lab.waitForState(out.taskId, ["report_ready", "failed"], lab.patienceMs);
    const worker = await lab.offers({ kind: "worker", taskId: out.taskId });
    const sup = await supervisorWithRole(lab, "S5");
    const supervisor = await lab.offers({ kind: "supervisor", label: "S5" });
    return [
      check("S5.worker-tools", "The worker is offered the report tool and none of the supervisor's", worker.tools.includes("factoryman_report") && !hasAny(worker.tools, SUPERVISOR_TOOLS), `tools: ${worker.tools.join(", ") || "none"}`),
      check("S5.worker-skills", "The worker is offered its own skill and not the supervisor's", worker.skills.includes("factoryman-worker") && !worker.skills.includes("factoryman-supervisor"), `skills: ${worker.skills.join(", ") || "none"}`),
      check("S5.supervisor-tools", "The supervisor is offered its five tools and not the report tool", hasAll(supervisor.tools, SUPERVISOR_TOOLS) && !supervisor.tools.includes("factoryman_report"), `tools: ${supervisor.tools.join(", ") || "none"} (thread ${sup.threadId})`),
      check("S5.supervisor-skills", "The supervisor is offered its own skill and not the worker's", supervisor.skills.includes("factoryman-supervisor") && !supervisor.skills.includes("factoryman-worker"), `skills: ${supervisor.skills.join(", ") || "none"}`),
    ];
  },
};
