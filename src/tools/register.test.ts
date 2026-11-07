import { createFakePluginHost, makePluginAgentConfigurationContext } from "@get-bb/plugin-sdk/testing";
import { describe, expect, it } from "vitest";
import { testRuntime } from "../../test/fixtures/runtime";
import type { MergeExecutor } from "../git/merge";
import { registerTools, skillsForMetadata } from "./register";

const executor: MergeExecutor = { preflight: async () => null, merge: async () => ({ ok: true }) };

function setup() {
  const host = createFakePluginHost({ pluginId: "factoryman" });
  const t = testRuntime();
  registerTools(host.bb, t.runtime, executor);
  return { host, t };
}

async function toolsFor(host: ReturnType<typeof setup>["host"], pluginMetadata: Record<string, unknown>) {
  const selected = await host.harness.behavior.resolveAgentConfiguration(makePluginAgentConfigurationContext({ pluginMetadata: pluginMetadata as never }));
  return selected.tools.map((tool) => tool.name).sort();
}

describe("registerTools", () => {
  it("[U33] offers the four supervisor tools to role supervisor", async () => {
    const { host } = setup();
    expect(await toolsFor(host, { role: "supervisor" })).toEqual(["factoryman_dispatch", "factoryman_merge", "factoryman_status", "factoryman_teardown"]);
  });

  it("[U34] offers only factoryman_report to role worker", async () => {
    const { host } = setup();
    expect(await toolsFor(host, { role: "worker", taskId: "t1" })).toEqual(["factoryman_report"]);
  });

  it("[U35] offers no tool for a missing role, an unknown role, or a role that is not a string", async () => {
    const { host } = setup();
    for (const metadata of [{}, { role: "admin" }, { role: 7 }, { role: ["supervisor"] }, { role: null }, { Role: "supervisor" }]) {
      expect(await toolsFor(host, metadata), JSON.stringify(metadata)).toEqual([]);
    }
  });

  it("[U36] registers exactly the five tool names and no sixth", () => {
    const { host } = setup();
    expect(host.harness.inspection.registrations.agentTools.map((tool) => tool.name).sort()).toEqual([
      "factoryman_dispatch",
      "factoryman_merge",
      "factoryman_report",
      "factoryman_status",
      "factoryman_teardown",
    ]);
  });

  it("[U37] advertises a dispatch schema that forbids extra fields and lists the three permission modes", () => {
    const { host } = setup();
    const dispatchTool = host.harness.inspection.registrations.agentTools.find((tool) => tool.name === "factoryman_dispatch");
    const schema = dispatchTool?.inputSchema as { type: string; additionalProperties: boolean; required: string[]; properties: { profile: { properties: { permissionMode: { enum: string[] } } } } };
    expect(schema.type).toBe("object");
    expect(schema.additionalProperties).toBe(false);
    // Milestone 7 made the profile optional: the dispatch rules choose it when the caller gives none (D-067).
    expect(schema.required).toEqual(["kind", "description"]);
    expect(Object.keys(schema.properties)).toEqual(expect.arrayContaining(["tags", "profile", "rule"]));
    expect(schema.properties.profile.properties.permissionMode.enum).toEqual(["accept-edits", "auto", "full"]);
  });

  it("[U38] refuses a call with a bad argument through the tool's own refusal text", async () => {
    const { host, t } = setup();
    t.bb.addThread({ id: "thr-sup" });
    const result = await host.harness.behavior.callAgentTool(
      "factoryman_dispatch",
      { kind: "epic", description: "x", profile: { provider: "a", model: "b", reasoningLevel: "c", permissionMode: "auto" } },
      { threadId: "thr-sup", projectId: "proj-1" },
    );
    expect(result).toMatchObject({ isError: true });
    expect(JSON.stringify(result)).toContain("invalid_event");
    expect(t.runtime.deps.store.listTasks()).toEqual([]);
  });

  it("[U39] returns an ok outcome as plain text and a failed outcome as an error result", async () => {
    const { host, t } = setup();
    t.bb.addThread({ id: "thr-sup" });
    const ok = await host.harness.behavior.callAgentTool("factoryman_status", {}, { threadId: "thr-sup", projectId: "proj-1" });
    expect(ok).toBe("No tasks match.");
    const failed = await host.harness.behavior.callAgentTool("factoryman_status", { taskId: "t9" }, { threadId: "thr-sup", projectId: "proj-1" });
    expect(failed).toEqual({ content: [{ type: "text", text: "No task t9 exists in this project." }], isError: true });
  });
});

describe("skillsForMetadata", () => {
  it("[U1101] returns the supervisor skill, the worker skill, or nothing, and ignores an unknown role", () => {
    expect(skillsForMetadata({ role: "supervisor" })).toEqual(["factoryman-supervisor"]);
    expect(skillsForMetadata({ role: "worker", taskId: "t1" })).toEqual(["factoryman-worker"]);
    expect(skillsForMetadata({})).toEqual([]);
    expect(skillsForMetadata({ role: "owner" })).toEqual([]);
    expect(skillsForMetadata({ role: 3 })).toEqual([]);
  });
});
