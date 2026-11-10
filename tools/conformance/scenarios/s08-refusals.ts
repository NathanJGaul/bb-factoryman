import { check, type Lab, type Scenario } from "../port.ts";
import { dispatchFailure, sleep } from "./helpers.ts";

/** S8: an empty report, a second report, and a teardown in the wrong state are each refused and logged, and a decision in the wrong state is refused. */
export const s8: Scenario = {
  id: "S8",
  title: "Refusals",
  tiers: ["1", "1.5"],
  async run(lab: Lab) {
    const checks = [];
    const empty = await lab.dispatch("scout", "S8 empty evidence probe", { flag: "empty-evidence" });
    if (empty.taskId === null) {
      checks.push(dispatchFailure("S8.empty-evidence-refused", "An empty report is refused and logged", empty.result.text));
    } else {
      const row = await lab.waitForState(empty.taskId, ["report_ready", "failed"], lab.patienceMs);
      const refused = (await lab.events(empty.taskId)).filter((e) => e.outcome === "refused" && e.reasonCode === "evidence_required");
      checks.push(check("S8.empty-evidence-refused", "Two empty reports are refused and logged, and the real report is accepted", refused.length >= 2 && row?.state === "report_ready", `${refused.length} refusal(s) with evidence_required; state ${row?.state ?? "none"}`));
    }
    const twice = await lab.dispatch("scout", "S8 double report probe", { flag: "double-report" });
    if (twice.taskId === null) {
      checks.push(dispatchFailure("S8.wrong-state-refused", "A second report is refused and logged", twice.result.text));
    } else {
      await lab.waitForState(twice.taskId, ["report_ready", "failed"], lab.patienceMs);
      await sleep(lab.settleMs);
      const events = await lab.events(twice.taskId);
      const refused = events.filter((e) => e.outcome === "refused" && e.reasonCode === "illegal_transition");
      const row = (await lab.tasks()).find((t) => t.taskId === twice.taskId);
      checks.push(check("S8.wrong-state-refused", "A second report is refused as an illegal transition and the state stays report_ready", refused.length >= 1 && row?.state === "report_ready", `${refused.length} illegal_transition refusal(s); state ${row?.state ?? "none"}`));
    }
    const silent = await lab.dispatch("scout", "S8 teardown probe", { flag: "silent" });
    if (silent.taskId === null) {
      checks.push(dispatchFailure("S8.teardown-wrong-state", "A teardown in the wrong state is refused and logged", silent.result.text));
    } else {
      await lab.waitForState(silent.taskId, ["working"], lab.patienceMs);
      await sleep(lab.settleMs);
      const result = await lab.callTool("factoryman_teardown", { taskId: silent.taskId });
      const refused = (await lab.events(silent.taskId)).filter((e) => e.outcome === "refused" && e.event === "teardown" && e.reasonCode === "illegal_transition");
      const row = (await lab.tasks()).find((t) => t.taskId === silent.taskId);
      checks.push(check("S8.teardown-wrong-state", "A teardown of a working task is refused, logged, and changes nothing", result.isError && refused.length === 1 && row?.state === "working", `tool error ${result.isError}; ${refused.length} logged refusal(s); state ${row?.state ?? "none"}`));
    }
    // A decision needs a ship task in needs_decision, and a scout task is refused for being a scout. The lab has no
    // no-mistakes pipeline, so a working ship task and the wrong-state refusal are the part that it can show (D-142).
    const ship = await lab.dispatch("ship", "S8 decide probe", { flag: "silent" });
    if (ship.taskId === null) {
      checks.push(dispatchFailure("S8.decide-wrong-state", "A decision on a working ship task is refused and changes nothing", ship.result.text));
    } else {
      await lab.waitForState(ship.taskId, ["working"], lab.patienceMs);
      await sleep(lab.settleMs);
      const decision = await lab.callTool("factoryman_decide", { taskId: ship.taskId, key: "nm-lab-probe-00000000", action: "approve" });
      const resolved = (await lab.events(ship.taskId)).filter((e) => e.event === "resolve");
      const after = (await lab.tasks()).find((t) => t.taskId === ship.taskId);
      checks.push(check("S8.decide-wrong-state", "A decision on a working ship task is refused, names needs_decision, records no resolve, and changes nothing", decision.isError && /needs_decision/.test(decision.text) && resolved.length === 0 && after?.state === "working", `tool error ${decision.isError}; ${resolved.length} resolve row(s); state ${after?.state ?? "none"}; text: ${decision.text.slice(0, 120)}`));
    }
    return checks;
  },
};
