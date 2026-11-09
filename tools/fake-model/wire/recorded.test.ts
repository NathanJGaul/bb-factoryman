import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { instructionText, pluginToolsIn, skillsIn } from "../instructions.ts";
import { messages } from "./messages.ts";

const recorded = JSON.parse(readFileSync(new URL("../../../test/fixtures/recorded/claude-code-supervisor-after-stamp.json", import.meta.url), "utf8")) as { request: unknown };

describe("a request that Claude Code really sent", () => {
  it("[U1422] names the four supervisor tools as deferred tools and lists the supervisor skill", () => {
    const conversation = messages.parse(recorded.request);
    const text = instructionText(conversation.system, conversation.turns.flatMap((t) => (t.role === "user" ? [t.text] : [])));
    expect(pluginToolsIn(text)).toEqual(["factoryman_dispatch", "factoryman_merge", "factoryman_status", "factoryman_teardown"]);
    expect(skillsIn(text)).toEqual(["factoryman-supervisor"]);
    expect(conversation.tools.map((tool) => tool.name)).toContain("ToolSearch");
    expect(conversation.turns.filter((t) => t.role === "user").at(-1)?.text).toContain("[conformance:sup=S5]");
  });
});
