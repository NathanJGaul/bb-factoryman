import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TOOL_NAMES } from "../../src/tools/register";
import { parseWorkflowConfig } from "../../src/workflow/config";
import { fences, headings, logicalLines, prose, section, sentences, tableRows, ticks } from "../fixtures/markdown";
import { loadWorld } from "../fixtures/plugin-host";
import cli from "../fixtures/bb-cli.json";

/** Read inside each test, so a missing runbook fails every test and not the whole file at once. */
const runbook = (): string => readFileSync(new URL("../../docs/LIVE-CHECK.md", import.meta.url), "utf8");
const shell = (body: string) => fences(body).filter((fence) => fence.lang === "sh");
/** Every command line of the shell blocks in a part of the runbook, with continuations joined and comments dropped. */
const commandLines = (body: string): string[] => shell(body).flatMap((fence) => logicalLines(fence.code));
const NEGATION = /\b(never|do not|don't|cannot|can't|must not|no agent|not to)\b/i;
const TOKEN_VARIABLES = "CLAUDE_CODE_OAUTH_TOKEN BB_CLAUDE_CODE_EXECUTABLE";

describe("the live-check runbook: isolation", () => {
  it("[A1107] says not to install into the owner's bb and never to touch the shared no-mistakes daemon, and runs every bb command inside the lab", () => {
    const text = runbook();
    expect(text).toContain("**Do not install the plugin into your own bb, and do not run the check against it.**");
    expect(text).toContain("**Never start, stop, or restart the shared no-mistakes daemon**");
    expect(text).toMatch(/live-isolation scout report/);
    expect(text).toMatch(/bb-factoryman-live-isolation\/report\.md/);

    const lines = commandLines(text);
    expect(lines.length).toBeGreaterThan(20);
    const bbCall = /(?:^|[\s;&|(`"'])bb\s+[a-z]/;
    for (const line of lines.filter((candidate) => bbCall.test(candidate))) expect(line, "a bb command outside the lab").toMatch(/bblab x /);
    for (const line of lines) expect(line, "a command that reaches the owner's bb data").not.toMatch(/~\/\.bb|\$HOME\/\.bb|\$\{HOME\}\/\.bb/);
    for (const line of lines.filter((candidate) => candidate.includes("bb plugin install"))) {
      expect(line).toMatch(/bblab x bb plugin install "\$BBLAB_DIR\/[^"]+"/);
    }
    // The only no-mistakes daemon command the runbook runs is a read.
    const daemonCalls = [...lines, ...ticks(prose(text))].flatMap((line) => [...line.matchAll(/no-mistakes daemon (\w+)/g)].map((match) => match[1]));
    for (const sub of daemonCalls) expect(sub, "a no-mistakes daemon command that changes the daemon").toBe("status");
  });

  it("[A1108] holds the eleven sections, the tier 0 checks, the seven hard-rule checks, the eight gaps, and the teardown checklist", () => {
    const text = runbook();
    expect(headings(text).filter((heading) => heading.startsWith("## "))).toEqual([
      "## 1. Where the isolation comes from",
      "## 2. Tiers",
      "## 3. Prerequisites",
      "## 4. Bring-up and install",
      "## 5. The throwaway project",
      "## 6. Tier 0 and tier 1: the free tiers, and the gate",
      "## 7. Tier 2: one scout task and one ship task, on the captain's own account",
      "## 8. Hard-rule checks to run in the lab",
      "## 9. What this check does not cover",
      "## 10. Teardown and the \"firstmate was undisturbed\" checklist",
      "## 11. Record the results",
    ]);
    expect(tableRows(section(text, "### Tier 0 checks")).map((row) => row[0])).toEqual([
      "The plugin's command",
      "The protection checklist",
      "The import dry run",
      "The read RPC",
      "The dispatch config",
      "The skills",
    ]);

    const hardRules = section(text, "## 8.")
      .split("\n")
      .filter((line) => /^\d+\. /.test(line));
    const expectedRules = [/`factoryman_merge` with no approval/, /`factoryman_teardown` on a task whose worktree has an uncommitted change/, /`done` with empty evidence/, /pinned to an offline machine/, /`local-only` work on another machine/, /`workflow\.json` with `yolo` or `gates`/, /pull request URL from another repository/];
    expect(hardRules).toHaveLength(expectedRules.length);
    expectedRules.forEach((pattern, index) => expect(hardRules[index], `hard-rule check ${index + 1}`).toMatch(pattern));
    expect(section(text, "## 8.")).toContain("Each of these must be refused and logged, and none may fail open.");

    const gaps = section(text, "## 9.")
      .split("\n")
      .filter((line) => line.startsWith("- "));
    const expectedGaps = [/real forge/, /second enrolled machine/, /answering the merge form/, /Cost data/, /same name/, /stub agent/, /no-mistakes pipeline run with a real agent/, /read the token from the environment of the lab's keeper process/];
    expect(gaps).toHaveLength(expectedGaps.length);
    expectedGaps.forEach((pattern, index) => expect(gaps[index], `gap ${index + 1}`).toMatch(pattern));

    const teardown = section(text, "## 10.");
    expect(commandLines(teardown)).toEqual(["bblab down", "bblab-evidence snap after", "bblab-evidence diff before after"]);
    expect(teardown).toContain("a tripwire count of zero");
    expect(teardown).toContain("the shared no-mistakes daemon at the same process ID and active");

    expect(text).toContain("**Scout task.**");
    expect(text).toContain("**Ship task.**");
    expect(section(text, "## 2.")).toMatch(/\*\*Funding decision \(made by the captain\)\.\*\*\nTier 2 is funded by the captain's own Claude account \(option B of the report's section 7\.3\)\./);
  });

  it("[A1109] names only plugin commands, flags, machines, tools, and bb commands that exist", async () => {
    const text = runbook();
    const world = await loadWorld();
    const registered = new Set((world.host.harness.inspection.registrations.cli?.commands ?? []).map((command) => command.name));
    const allowedFlags: Record<string, string[]> = { preflight: ["--project", "--provider"], "import-registry": ["--file", "--apply"], protection: [], supervisor: [] };
    const calls = [...text.matchAll(/bb factoryman ([a-z-]+)([^\n`|)]*)/g)];
    expect(calls.length).toBeGreaterThan(4);
    for (const [, command = "", rest = ""] of calls) {
      expect(registered, command).toContain(command);
      for (const flag of rest.match(/(?<![\w-])--[a-z][a-z-]*/g) ?? []) expect(allowedFlags[command], `${command} ${flag}`).toContain(flag);
    }
    // The lab's one machine is named server (the report's section 6.1).
    expect(text).toMatch(/bb factoryman preflight server --project \$PROJ/);
    expect(text).not.toMatch(/preflight lab-box/);
    for (const tool of new Set(text.match(/factoryman_[a-z_]+/g) ?? [])) expect(TOOL_NAMES, tool).toContain(tool);

    const known = Object.keys(cli.commands).sort((a, b) => b.length - a.length);
    const flagsOf = (key: string) => (cli.commands as Record<string, { flags: string[] }>)[key]?.flags ?? [];
    const calledBb: string[] = [...commandLines(text).flatMap((line) => [...line.matchAll(/bblab x bb ((?:[a-z-]+ ?)+)(.*)/g)].map((match) => `${match[1]}${match[2]}`)), ...ticks(prose(text)).filter((token) => token.startsWith("bb ")).map((token) => token.slice(3))];
    expect(calledBb.length).toBeGreaterThan(15);
    for (const call of calledBb) {
      if (call.startsWith("factoryman")) continue;
      const key = known.find((candidate) => call === candidate || call.startsWith(`${candidate} `));
      expect(key, `\`bb ${call}\` is not a bb ${cli.bbVersion} command that the runbook checked`).toBeDefined();
      for (const flag of call.match(/(?<![\w-])--[a-z][a-z-]*/g) ?? []) expect(flagsOf(key as string), `bb ${key} ${flag}`).toContain(flag);
    }
  });
});

describe("the live-check runbook: the funding decision and the credential", () => {
  it("[A1111] funds tier 2 from the captain's own Claude account, says that it competes with firstmate, and has only the captain create the token", () => {
    const text = runbook();
    const tiers = section(text, "## 2.");
    expect(tiers).toContain("Tier 2 is funded by the captain's own Claude account (option B of the report's section 7.3).");
    expect(tiers).toContain("It competes with firstmate for the same quota windows, so keep it short and cheap.");
    expect(tiers).not.toMatch(/Tier 2 needs a decision from you/);
    expect(tableRows(tiers).find((row) => row[0] === "2")?.[2]).toBe("the captain's own Claude account");

    const setup = sentences(prose(text)).filter((sentence) => sentence.includes("claude setup-token"));
    expect(setup.length).toBeGreaterThan(0);
    for (const sentence of setup) expect(sentence, "only the captain runs setup-token").toMatch(/^Only the captain runs/);
  });

  it("[A1114] puts the token in no file, no command line, and no agent's hands: the shell blocks name it on four fixed lines, and nothing else does", () => {
    const text = runbook();
    const naming = (line: string) => /CLAUDE_CODE_OAUTH_TOKEN|setup-token|BBLAB_PASS_ENV/.test(line);
    const allowed = [
      "read -rs CLAUDE_CODE_OAUTH_TOKEN",
      "export CLAUDE_CODE_OAUTH_TOKEN",
      `export BBLAB_PASS_ENV="${TOKEN_VARIABLES}"`,
      "unset CLAUDE_CODE_OAUTH_TOKEN BB_CLAUDE_CODE_EXECUTABLE BBLAB_PASS_ENV BBLAB_RO",
    ];
    const lines = commandLines(text).filter(naming);
    expect(lines).toEqual(allowed);
    // No comment in a block hands the token over either.
    const raw = shell(text).flatMap((fence) => fence.code.split("\n")).filter((line) => /setup-token/.test(line));
    expect(raw).toEqual(["read -rs CLAUDE_CODE_OAUTH_TOKEN          # paste the token that `claude setup-token` printed, then press Enter"]);

    // No assignment of any kind, quoted or not, and no secret-shaped literal anywhere in the file.
    expect(text).not.toMatch(/CLAUDE_CODE_OAUTH_TOKEN\s*=/);
    expect(text).not.toMatch(/\b\w*TOKEN\w*\s*=\s*["']?[A-Za-z0-9_-]{8,}/);
    expect(text).not.toMatch(/sk-ant-[A-Za-z0-9_-]{8,}|gh[pousr]_[A-Za-z0-9]{8,}|github_pat_|oauth_token:|Bearer\s+\S{8,}/);
    for (const line of lines) expect(line, "a redirect, a pipe, or a substitution on a token line").not.toMatch(/[<>|]|\$\(|`|\bcat\b|\becho\b|\bprintf\b|\btee\b/);

    // The variable list that reaches the lab is exactly the two the Claude CLI needs.
    const pass = lines.find((line) => line.startsWith("export BBLAB_PASS_ENV="));
    expect((pass?.match(/"([^"]*)"/)?.[1] ?? "").split(" ").sort()).toEqual(["BB_CLAUDE_CODE_EXECUTABLE", "CLAUDE_CODE_OAUTH_TOKEN"]);

    // Prose: any sentence that puts the token and an agent, a thread, a prompt, or a chat together must forbid it.
    // The part that says what can read the token is a disclosure and not an instruction, so it is the one part that is exempt.
    const disclosure = new Set(sentences(section(text, "### What can read the token")));
    for (const sentence of sentences(prose(text)).filter((candidate) => !disclosure.has(candidate))) {
      if (!/\btoken\b/i.test(sentence) || !/\b(agent|supervisor|worker|thread|prompt|chat)\b/i.test(sentence)) continue;
      expect(sentence, "a sentence that hands the token to an agent").toMatch(NEGATION);
    }
    expect(prose(text)).toContain("No agent creates, reads, or handles the token while you set it up.");
    expect(prose(text)).toContain("Do not paste the token into a chat, a file, or a command line.");

    // The token lives only in a fresh shell, and the run ends with revoking it.
    const tier2 = section(text, "## 7.");
    const block = commandLines(tier2);
    const order = ["bblab down", 'env -i HOME="$HOME" PATH="$PATH" TERM="$TERM" BBLAB_DIR="$BBLAB_DIR" EVIDENCE_DIR="$EVIDENCE_DIR" bash --noprofile --norc', "read -rs CLAUDE_CODE_OAUTH_TOKEN", "bblab up"].map((line) => block.indexOf(line));
    expect(order.every((index) => index >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    const stop = section(tier2, "### Stop and clean up the token");
    expect(commandLines(stop)).toEqual(['kill "$WATCHDOG"', "bblab down", "unset CLAUDE_CODE_OAUTH_TOKEN BB_CLAUDE_CODE_EXECUTABLE BBLAB_PASS_ENV BBLAB_RO", "exit"]);
    expect(prose(stop)).toContain("Then revoke the token in your Claude account settings");
  });

  it("[A1124] says what can read the token, and has the run start from a fresh shell", () => {
    const part = section(runbook(), "### What can read the token");
    expect(part).toContain("may be able to read the token from its environment");
    expect(part).toContain("Revoke the token when the run ends");
    expect(part).toContain("Run tier 2 from a fresh shell that holds only what the run needs");
  });
});

describe("the live-check runbook: spend caps and the gate", () => {
  it("[A1112] carries the spend caps, and the values that the owner runs match them", () => {
    const text = runbook();
    const caps = tableRows(section(text, "### Spend caps"));
    expect(caps.map((row) => row[0])).toEqual(["The cheapest model", "A low reasoning level", "One worker at a time", "Two tasks", "A tiny repository", "A wall-clock limit", "The hard stop"]);
    const how = new Map(caps.map((row) => [row[0], row[1] ?? ""]));
    expect(how.get("The cheapest model")).toContain("Haiku-class");
    expect(how.get("A low reasoning level")).toContain("--reasoning-level low");
    expect(how.get("One worker at a time")).toContain('"maxWorkers": 1');
    expect(how.get("Two tasks")).toContain('"maxTasksPerDay": 2');
    expect(how.get("A wall-clock limit")).toContain("after 30 minutes");
    expect(how.get("The hard stop")).toContain("`bblab down`");

    // The workflow file in the runbook is the one the plugin enforces.
    const json = fences(section(text, "## 5.")).find((fence) => fence.lang === "json");
    expect(json).toBeDefined();
    const parsed = parseWorkflowConfig(JSON.parse(json?.code ?? "{}"));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.config.limits).toMatchObject({ maxWorkers: 1, maxTasksPerDay: 2 });

    // The commands carry the same caps.
    const tier2 = commandLines(section(text, "## 7."));
    const spawn = tier2.find((line) => line.includes("bb thread spawn"));
    expect(spawn).toBeDefined();
    expect(spawn).toContain("--provider claude-code");
    expect(spawn).toContain("--model <cheapest model>");
    expect(spawn).toContain("--reasoning-level low");
    expect(tier2).toContain('(sleep 1800 && bblab down) > "$BBLAB_DIR/logs/watchdog.txt" 2>&1 &');
    expect(tier2).toContain("WATCHDOG=$!");
    expect(prose(section(text, "### Spend caps"))).toContain("Keep the ship task in `local-only` mode.");
  });

  it("[A1113] runs tiers 0 and 1 first, makes tier 2 wait for them, and states the four conditions of the gate and the stub-agent rule", () => {
    const text = runbook();
    const tiers = section(text, "## 2.");
    expect(tiers).toContain("Run tiers 0 and 1 first.");
    expect(tiers).toContain("**Tier 2 waits for tiers 0 and 1.**");

    const tier1 = section(text, "### Tier 1");
    expect(tier1).toContain("That stub agent does not exist yet.");
    expect(tier1).toContain("Until the stub agent exists, tier 1 cannot run.");

    const gate = section(text, "### The gate");
    expect(gate).toContain("**Do not start tier 2 until** all of this holds:");
    const items = gate.split("\n").filter((line) => /^\d+\. /.test(line));
    const expected = [/Every tier 0 check passed, and `pnpm run check` passed/, /Tier 1 passed\. Or, while the stub agent does not exist yet, you wrote this line in `spike\/RESULTS\.md`: "Tier 1 skipped: no stub agent\. Tier 2 goes ahead without it\."/, /`bblab status` shows a tripwire count of zero/, /You have read the caps in section 7/];
    expect(items).toHaveLength(expected.length);
    expected.forEach((pattern, index) => expect(items[index], `gate condition ${index + 1}`).toMatch(pattern));
    expect(gate).toContain("That skip is your decision.");

    // The credential enters only in section 7, after the section that holds the gate.
    expect(text.indexOf("## 6. Tier 0 and tier 1")).toBeLessThan(text.indexOf("## 7. Tier 2"));
    expect(text.indexOf("BBLAB_PASS_ENV")).toBeGreaterThan(text.indexOf("## 7. Tier 2"));
    expect(text.indexOf("read -rs")).toBeGreaterThan(text.indexOf("## 7. Tier 2"));
  });
});

describe("the live-check runbook: steps that a reader can follow without asking", () => {
  it("[A1122] sets the project to local-only with a script that leaves yolo off, and drives the supervisor with bb thread tell", () => {
    const text = runbook();
    const script = fences(section(text, "## 5.")).find((fence) => fence.code.includes("project_config"));
    expect(script, "the script that writes the project config").toBeDefined();
    expect(script?.code).toContain("VALUES (?, ?, 0, NULL, ?, NULL)");
    expect(script?.code).toContain(".run('$PROJ', 'local-only', 'main')");
    expect(script?.code).toContain("/plugins/bb-factoryman/data.db");

    const tier2 = commandLines(section(text, "## 7."));
    expect(tier2.filter((line) => line.includes("bb thread tell")).length).toBeGreaterThanOrEqual(1);
    expect(tier2).toContain('bblab x bb factoryman supervisor "$SUP"');
    expect(tier2.findIndex((line) => line.includes("bb thread spawn"))).toBeLessThan(tier2.indexOf('bblab x bb factoryman supervisor "$SUP"'));
    expect(tier2.indexOf('bblab x bb factoryman supervisor "$SUP"')).toBeLessThan(tier2.findIndex((line) => line.includes("bb thread tell")));
    expect(prose(section(text, "## 7."))).toContain("The stamp applies from the thread's next session, and the thread already ran its first turn.");
    expect(text).not.toMatch(/on the first turn/);
  });

  it("[A1123] reads the Claude usage before and after tier 2 and compares it with the caps", () => {
    const text = runbook();
    expect(section(text, "## 3.")).toContain("Read your Claude usage on your account's usage page and write the numbers down.");
    const teardown = section(text, "## 10.");
    expect(teardown).toContain("Read your Claude usage again and compare it with the numbers from section 3.");
    expect(teardown).toContain("The difference must match the caps in section 7.");
  });
});
