import { readFileSync, readdirSync } from "node:fs";
import { makePluginAgentConfigurationContext } from "@get-bb/plugin-sdk/testing";
import { describe, expect, it } from "vitest";
import { TOOL_NAMES } from "../../src/tools/register";
import { loadWorld } from "../fixtures/plugin-host";

const root = new URL("../../", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), "utf8");
const SKILLS = ["factoryman-supervisor", "factoryman-worker"] as const;
const SUPERVISOR_TOOLS = ["factoryman_dispatch", "factoryman_status", "factoryman_merge", "factoryman_teardown"];

function frontmatter(text: string): Record<string, string> {
  const match = /^---\n([\s\S]*?)\n---\n/.exec(text);
  if (!match) throw new Error("no front matter");
  return Object.fromEntries((match[1] as string).split("\n").map((line) => [line.slice(0, line.indexOf(":")), line.slice(line.indexOf(":") + 1).trim()]));
}

describe("the supervisor and worker skills", () => {
  it("[A1101] has exactly two skill directories, and each SKILL.md has a name that matches its directory and a one-line description", () => {
    expect(readdirSync(new URL("skills/", root)).sort()).toEqual([...SKILLS]);
    for (const skill of SKILLS) {
      const meta = frontmatter(read(`skills/${skill}/SKILL.md`));
      expect(Object.keys(meta).sort()).toEqual(["description", "name"]);
      expect(meta["name"]).toBe(skill);
      expect(meta["description"]?.length ?? 0).toBeGreaterThan(40);
      expect(meta["description"]?.length ?? 0).toBeLessThan(400);
    }
  });

  it("[A1102] selects the supervisor skill for a supervisor thread, the worker skill for a worker thread, and none for any other thread", async () => {
    const world = await loadWorld();
    const skillsFor = async (pluginMetadata: Record<string, unknown>) =>
      (await world.host.harness.behavior.resolveAgentConfiguration(makePluginAgentConfigurationContext({ pluginMetadata: pluginMetadata as never }))).skills;
    expect(await skillsFor({ role: "supervisor" })).toEqual(["factoryman-supervisor"]);
    expect(await skillsFor({ role: "worker", taskId: "t1" })).toEqual(["factoryman-worker"]);
    expect(await skillsFor({})).toEqual([]);
    expect(await skillsFor({ role: "owner" })).toEqual([]);
  });

  it("[A1103] names every tool of its role, and no tool that the plugin does not register", () => {
    const supervisor = read("skills/factoryman-supervisor/SKILL.md");
    for (const tool of SUPERVISOR_TOOLS) expect(supervisor, tool).toContain(`\`${tool}\``);
    expect(read("skills/factoryman-worker/SKILL.md")).toContain("`factoryman_report`");
    for (const skill of SKILLS) {
      const mentioned = new Set(read(`skills/${skill}/SKILL.md`).match(/factoryman_[a-z_]+/g) ?? []);
      for (const tool of mentioned) expect(TOOL_NAMES, `${skill} mentions ${tool}`).toContain(tool);
    }
    expect(read("skills/factoryman-worker/SKILL.md")).not.toMatch(/factoryman_(dispatch|merge|teardown|status)/);
  });

  it("[A1104] names only `bb factoryman` commands that the plugin registers", async () => {
    const world = await loadWorld();
    const registered = new Set((world.host.harness.inspection.registrations.cli?.commands ?? []).map((command) => command.name));
    const mentioned = new Set<string>();
    for (const skill of SKILLS) for (const match of read(`skills/${skill}/SKILL.md`).matchAll(/bb factoryman ([a-z-]+)/g)) mentioned.add(match[1] as string);
    expect(mentioned.size).toBeGreaterThan(0);
    for (const command of mentioned) expect(registered, command).toContain(command);
  });

  it("[A1105] says what the plugin enforces in code, and never tells an agent to get around a gate", () => {
    const supervisor = read("skills/factoryman-supervisor/SKILL.md");
    const worker = read("skills/factoryman-worker/SKILL.md");
    for (const [name, text] of [["supervisor", supervisor], ["worker", worker]] as const) {
      expect(text, name).toMatch(/enforces every gate in code/);
    }
    expect(supervisor).toMatch(/never edit project files/i);
    expect(supervisor).toMatch(/Never retry with a weaker setting/);
    expect(supervisor).toMatch(/cannot answer a finding/i);
    expect(supervisor).toMatch(/approval form/i);
    expect(worker).toMatch(/\*\*Never push to `origin`\.\*\*/);
    expect(worker).toMatch(/Do not contact the owner/);
    expect(worker).toMatch(/Evidence is required and must not be empty/);
    expect(worker).toMatch(/Never merge, and never tear down/);
  });
});
