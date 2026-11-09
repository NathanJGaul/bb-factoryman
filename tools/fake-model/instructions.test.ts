import { describe, expect, it } from "vitest";
import { instructionText, pluginToolsIn, skillsIn } from "./instructions.ts";

describe("what a harness tells its model", () => {
  it("[U1410] finds plugin tools by every route and skills in the instruction text, and ignores the same names in the task text", () => {
    const system = 'Skills: bb-global-skills:factoryman-supervisor. MCP Tool Routes: "factoryman_report" -> xd://mcp__bb_bridge_factoryman_report';
    const reminder = "<system-reminder>deferred: mcp__bb-bridge__factoryman_dispatch, mcp__bb-bridge__update_environment_directory</system-reminder>";
    const bbBlock = "<system_instructions>Available bb skills: factoryman-worker</system_instructions>";
    const task = "You are the worker. Read the factoryman-worker skill. Call factoryman_status and factoryman_merge when you finish.";
    const text = instructionText(system, [`${reminder}\n${task}`, `${bbBlock}\n${task}`]);
    expect(skillsIn(text)).toEqual(["factoryman-supervisor", "factoryman-worker"]);
    expect(pluginToolsIn(text)).toEqual(["factoryman_dispatch", "factoryman_report"]);
    expect(text).not.toContain("factoryman_merge");
    expect(skillsIn(instructionText("", [task]))).toEqual([]);
    expect(pluginToolsIn(instructionText("", [task]))).toEqual([]);
  });
});
