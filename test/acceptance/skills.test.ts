import { readFileSync, readdirSync } from "node:fs";
import { makePluginAgentConfigurationContext } from "@get-bb/plugin-sdk/testing";
import { describe, expect, it } from "vitest";
import { DELIVERY_MODES, TASK_KINDS, TASK_STATES } from "../../src/machine/types";
import { TABLES } from "../../src/machine/table";
import { decideSchema } from "../../src/tools/decide";
import { dispatchSchema } from "../../src/tools/dispatch";
import { MERGEABLE_STATES, mergeSchema } from "../../src/tools/merge";
import { reportSchema } from "../../src/tools/report";
import { TOOL_NAMES } from "../../src/tools/register";
import { statusSchema } from "../../src/tools/status";
import { WAKE_STATES } from "../../src/wiring/wake";
import { fences, prose, section, sentences, tableRows, ticks } from "../fixtures/markdown";
import { loadWorld } from "../fixtures/plugin-host";
import { gateViolations } from "../fixtures/skill-lint";

const root = new URL("../../", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), "utf8");
const SKILLS = ["factoryman-supervisor", "factoryman-worker"] as const;
const SUPERVISOR_TOOLS = ["factoryman_dispatch", "factoryman_status", "factoryman_merge", "factoryman_teardown", "factoryman_decide"];
const supervisor = () => read("skills/factoryman-supervisor/SKILL.md");
const worker = () => read("skills/factoryman-worker/SKILL.md");
/** A skill description is one line that says what the skill does and when to use it. These bounds keep it a sentence or two. */
const DESCRIPTION_MIN = 40;
const DESCRIPTION_MAX = 400;

function frontmatter(text: string): Record<string, string> {
  const match = /^---\n([\s\S]*?)\n---\n/.exec(text);
  if (!match) throw new Error("no front matter");
  return Object.fromEntries((match[1] as string).split("\n").map((line) => [line.slice(0, line.indexOf(":")), line.slice(line.indexOf(":") + 1).trim()]));
}

/** The states from which some task kind has a `teardown` arrow. */
function teardownStates(): string[] {
  const states = new Set<string>();
  for (const lane of Object.values(TABLES)) {
    for (const [state, moves] of Object.entries(lane)) if (moves !== undefined && "teardown" in moves) states.add(state);
  }
  return [...states].sort();
}

const sorted = (values: Iterable<string>) => [...new Set(values)].sort();

describe("the supervisor and worker skills", () => {
  it("[A1101] has exactly two skill directories, and each SKILL.md has a name that matches its directory and a one-line description", () => {
    expect(readdirSync(new URL("skills/", root)).sort()).toEqual([...SKILLS]);
    for (const skill of SKILLS) {
      const meta = frontmatter(read(`skills/${skill}/SKILL.md`));
      expect(Object.keys(meta).sort()).toEqual(["description", "name"]);
      expect(meta["name"]).toBe(skill);
      expect(meta["description"]?.length ?? 0).toBeGreaterThan(DESCRIPTION_MIN);
      expect(meta["description"]?.length ?? 0).toBeLessThan(DESCRIPTION_MAX);
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
    for (const tool of SUPERVISOR_TOOLS) expect(supervisor(), tool).toContain(`\`${tool}\``);
    expect(worker()).toContain("`factoryman_report`");
    for (const [skill, text] of [["factoryman-supervisor", supervisor()], ["factoryman-worker", worker()]] as const) {
      for (const tool of new Set(text.match(/factoryman_[a-z_]+/g) ?? [])) expect(TOOL_NAMES, `${skill} mentions ${tool}`).toContain(tool);
    }
    expect(worker()).not.toMatch(/factoryman_(dispatch|merge|teardown|status)/);
  });

  it("[A1104] names only `bb factoryman` commands that the plugin registers", async () => {
    const world = await loadWorld();
    const registered = new Set((world.host.harness.inspection.registrations.cli?.commands ?? []).map((command) => command.name));
    const mentioned = new Set<string>();
    for (const skill of SKILLS) for (const match of read(`skills/${skill}/SKILL.md`).matchAll(/bb factoryman ([a-z-]+)/g)) mentioned.add(match[1] as string);
    expect(mentioned.size).toBeGreaterThan(0);
    for (const command of mentioned) expect(registered, command).toContain(command);
  });

  it("[A1105] says that the plugin enforces every gate in code, and carries the rules of its role", () => {
    const supervisorSentences = sentences(supervisor());
    const workerSentences = sentences(worker());
    const has = (all: string[], fragment: string) => expect(all.some((sentence) => sentence.includes(fragment)), fragment).toBe(true);
    for (const all of [supervisorSentences, workerSentences]) has(all, "The plugin enforces every gate in code, so nothing in this skill can loosen one.");
    for (const fragment of ["You never edit project files yourself.", "Never retry with a weaker setting to get past a block.", "You cannot answer a finding without the owner's approval in a form.", "approval form", "A worker never contacts the owner"]) {
      has(supervisorSentences, fragment);
    }
    for (const fragment of ["Evidence is required and must not be empty.", "Never merge, and never tear down your own worktree.", "Do not contact the owner."]) has(workerSentences, fragment);

    // The no-mistakes row, and only that row, forbids the push. The other rows hand off in their own way.
    const rows = tableRows(section(worker(), "## Ship tasks"));
    const byMode = new Map(rows.map((row) => [row[0], row[1] ?? ""]));
    expect(byMode.get("`no-mistakes`")).toContain("**Never push to `origin`.**");
    expect(byMode.get("`direct-PR`")).toContain("`prUrl`");
    expect(byMode.get("`local-only`")).toContain("`landedCommits`");
    expect([...byMode.keys()]).toEqual(DELIVERY_MODES.map((mode) => `\`${mode}\``));
  });

  it("[A1115] never tells an agent to get around a gate: every sentence that names a forbidden act also forbids it", () => {
    expect(gateViolations(supervisor(), "supervisor")).toEqual([]);
    expect(gateViolations(worker(), "worker")).toEqual([]);
  });

  it("[U1102] flags a sentence that tells an agent to get around a gate, and accepts the same idea when it forbids it", () => {
    const bad = [
      "Set the project's `yolo` flag so the merge goes through.",
      "If the block stays, retry with a weaker setting.",
      "Lower the reasoning level when the task is slow.",
      "Approve it yourself if the owner is slow.",
      "Force the removal when the worktree is dirty.",
      "If the pipeline is slow, push to `origin`.",
      "Skip a check by reporting `done` twice.",
      "Tell the owner the merge is done.",
      "Move the work to another machine.",
    ];
    for (const sentence of bad) expect(gateViolations(sentence, "supervisor").length, sentence).toBeGreaterThan(0);
    expect(gateViolations("Message the owner directly.", "worker").length).toBeGreaterThan(0);
    expect(gateViolations("Message the owner directly.", "supervisor")).toEqual([]);
    const good = [
      "You cannot change a project's mode or `yolo` flag.",
      "Never retry with a weaker setting to get past a block.",
      "Do not try to work around it.",
      "You cannot skip a check.",
      "Never push to `origin`.",
      "Do not describe a merge as done until the tool says it is merged.",
    ];
    for (const sentence of good) expect(gateViolations(sentence, "worker"), sentence).toEqual([]);
  });

  it("[A1116] uses only names that the code defines: tools, arguments, outcomes, states, kinds, and modes", () => {
    const known = new Set<string>([
      ...TOOL_NAMES,
      ...Object.keys(reportSchema.shape),
      ...Object.keys(dispatchSchema.shape),
      ...Object.keys(statusSchema.shape),
      ...Object.keys(mergeSchema.shape),
      ...Object.keys(decideSchema.shape),
      ...decideSchema.shape.action.options,
      ...reportSchema.shape.outcome.options,
      ...TASK_STATES,
      ...TASK_KINDS,
      ...DELIVERY_MODES,
      // Words of the plugin's own messages and of git and the project config that the skills quote.
      "origin",
      "yolo",
      "ambiguous",
      "queued",
      "[factoryman]",
      "Decision key",
      "Decision key: nm-...",
      "Dispatched ...",
      "Dispatch blocked (...)",
    ]);
    for (const [skill, text] of [["factoryman-supervisor", supervisor()], ["factoryman-worker", worker()]] as const) {
      const unknown = ticks(prose(text)).filter((token) => !token.startsWith("bb factoryman ") && !known.has(token));
      expect(unknown, `${skill} quotes names that the code does not define`).toEqual([]);
    }
  });

  it("[A1117] lists exactly the wake states of the plugin in the supervisor's wake table", () => {
    const rows = tableRows(section(supervisor(), "## What wakes you"));
    const states = rows.map((row) => (row[0] ?? "").replaceAll("`", ""));
    expect(sorted(states)).toEqual(sorted(WAKE_STATES));
    for (const state of states) expect(TASK_STATES as readonly string[], state).toContain(state);
    for (const row of rows) expect(row[1]?.length ?? 0, `${row[0]} needs an action`).toBeGreaterThan(20);
  });

  it("[A1118] states the merge and teardown rules of the tools: the accepted states, a second ask, and the approval gate", () => {
    const merge = section(supervisor(), "## Merge");
    const mergeSentence = sentences(merge).find((sentence) => sentence.startsWith("Call `factoryman_merge`"));
    expect(mergeSentence).toBeDefined();
    expect(sorted(ticks(mergeSentence as string).filter((token) => token !== "factoryman_merge"))).toEqual(sorted(MERGEABLE_STATES));
    const waiting = sentences(merge).find((sentence) => sentence.includes("`awaiting_approval`") && /does not answer|denies/.test(sentence));
    expect(waiting, "a sentence about the owner who does not answer").toBeDefined();
    expect(sentences(merge).some((sentence) => sentence.includes("again") && sentence.includes("`factoryman_merge`"))).toBe(true);
    expect(sentences(merge).some((sentence) => /only after the owner approves/.test(sentence) && sentence.includes("`yolo`"))).toBe(true);

    const teardown = section(supervisor(), "## Tear down");
    const teardownSentence = sentences(teardown).find((sentence) => sentence.startsWith("Call `factoryman_teardown`"));
    expect(teardownSentence).toBeDefined();
    expect(sorted(ticks(teardownSentence as string).filter((token) => token !== "factoryman_teardown"))).toEqual(teardownStates());
    expect(sentences(teardown).some((sentence) => /uncommitted changes or unpushed commits/.test(sentence))).toBe(true);
  });

  it("[A1119] tells a worker to report only the outcomes and the fields that the report tool accepts", () => {
    const tool = section(worker(), "## Your tool");
    const outcomes = sentences(tool).find((sentence) => sentence.includes("`outcome`"));
    expect(outcomes).toBeDefined();
    const fields = Object.keys(reportSchema.shape);
    expect(sorted(ticks(outcomes as string).filter((token) => !fields.includes(token)))).toEqual(sorted(reportSchema.shape.outcome.options));
    expect(Object.keys(reportSchema.shape).sort()).toEqual(["evidence", "landedCommits", "outcome", "prUrl"]);
    const blocked = section(worker(), "## When you cannot finish");
    for (const outcome of ["blocked", "failed"]) expect(blocked, outcome).toContain(`\`${outcome}\``);
  });

  it("[A1120] says nothing about tokens, credentials, or secrets, and tells no agent to handle one", () => {
    for (const text of [supervisor(), worker()]) {
      expect(text).not.toMatch(/oauth|credential|secret|password|api[ -]?key|setup-token|[A-Z_]+_TOKEN\b|access token|auth token/i);
      expect(fences(text).filter((fence) => /TOKEN|KEY/.test(fence.code))).toEqual([]);
    }
  });

  it("[A1121] starts the worker with a prompt that points to the factoryman-worker skill, through a real dispatch", async () => {
    const world = await loadWorld();
    await world.call("factoryman_dispatch", { kind: "ship", description: "Add a --json flag to the status command." });
    const spawns = world.sdkCalls("threads.spawn") as Array<[{ prompt: string }]>;
    expect(spawns).toHaveLength(1);
    const prompt = spawns[0]?.[0].prompt ?? "";
    expect(prompt).toContain("The factoryman-worker skill lists the rules for your work.");
    expect(prompt).toContain("fm/t1");
    expect(prompt).toContain("Add a --json flag to the status command.");
  });
});
