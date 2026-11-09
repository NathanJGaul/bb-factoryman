import { check, type Lab, type Scenario } from "../port.ts";
import { dispatchFailure, until } from "./helpers.ts";

/** S11: teardown is refused while the worktree is dirty, and removes a clean worktree and leaves no process behind. */
export const s11: Scenario = {
  id: "S11",
  title: "Teardown",
  tiers: ["1", "1.5"],
  async run(lab: Lab) {
    const out = await lab.dispatch("scout", "S11 teardown probe", { flag: "dirty" });
    if (out.taskId === null) return [dispatchFailure("S11.dirty-refused", "A dirty worktree is not torn down", out.result.text)];
    const id = out.taskId;
    await lab.waitForState(id, ["report_ready", "failed"], lab.patienceMs);
    const path = await lab.worktree(id);
    const first = await lab.callTool("factoryman_teardown", { taskId: id });
    const refused = (await lab.events(id)).filter((e) => e.outcome === "refused" && e.reasonCode === "unlanded_work");
    const afterFirst = (await lab.tasks()).find((t) => t.taskId === id);
    const kept = await lab.worktree(id);
    const checks = [
      check("S11.dirty-refused", "A dirty worktree is refused as unlanded work, logged, and the task keeps its state", first.isError && refused.length === 1 && afterFirst?.state === "report_ready", `tool error ${first.isError}; ${refused.length} unlanded_work refusal(s); state ${afterFirst?.state ?? "none"}`),
      check("S11.dirty-kept", "The dirty worktree is still there", path !== null && kept === path, `worktree: ${kept ?? "gone"}`),
    ];
    if (path !== null) await lab.sh(`rm -f ${path}/UNTRACKED.txt`);
    const second = await lab.callTool("factoryman_teardown", { taskId: id });
    const gone = await until(lab, async () => ((await lab.worktree(id)) === null ? true : null));
    const final = (await lab.tasks()).find((t) => t.taskId === id);
    checks.push(check("S11.clean-removed", "A clean worktree is torn down and removed", !second.isError && final?.state === "torn_down" && gone === true, `tool error ${second.isError}; state ${final?.state ?? "none"}; worktree ${gone === true ? "removed" : "still there"}`));
    const left = path === null ? [] : await lab.processes(path);
    checks.push(check("S11.no-process-left", "No process is left in the removed worktree", path !== null && left.length === 0, left.length === 0 ? "no process matches the worktree path" : left.join("; ")));
    return checks;
  },
};
