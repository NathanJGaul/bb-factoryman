import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { contractFor } from "../../src/harness/contracts";
import { TOOL_NAMES } from "../../src/tools/register";
import { parseWorkflowConfig } from "../../src/workflow/config";
import { HARNESS_IDS, resolveDriver } from "../../tools/conformance/drivers/index";
import { USAGE as CONFORMANCE_USAGE } from "../../tools/conformance/args";
import { fences, headings, logicalLines, prose, section, sentences, tableRows, ticks } from "../fixtures/markdown";
import { loadWorld } from "../fixtures/plugin-host";
import cli from "../fixtures/bb-cli.json";

/** Read inside each test, so a missing runbook fails every test and not the whole file at once. */
const runbook = (): string => readFileSync(new URL("../../docs/LIVE-CHECK.md", import.meta.url), "utf8");
const shell = (body: string) => fences(body).filter((fence) => fence.lang === "sh");
/** Every command line of the shell blocks in a part of the runbook, with continuations joined and comments dropped. */
const commandLines = (body: string): string[] => shell(body).flatMap((fence) => logicalLines(fence.code));
const NEGATION = /\b(never|do not|don't|cannot|can't|must not|no agent|not to)\b/i;
const CLAUDE_VARIABLES = "CLAUDE_CODE_OAUTH_TOKEN BB_CLAUDE_CODE_EXECUTABLE";
const OPENAI_VARIABLES = "OPENAI_API_KEY";
/** The four harnesses of the tier 2 table, in the order of the conformance tool, with the facts the drivers and the contract table hold. */
const HARNESSES = HARNESS_IDS.map((id) => {
  const resolved = resolveDriver(id);
  if (!resolved.ok) throw new Error(resolved.message);
  return { id, title: resolved.driver.title, provider: resolved.driver.provider };
});

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


  it("[A1108] holds the eleven sections, the tier 0 checks, the seven hard-rule checks, the nine gaps, and the teardown checklist", () => {
    const text = runbook();
    expect(headings(text).filter((heading) => heading.startsWith("## "))).toEqual([
      "## 1. Where the isolation comes from",
      "## 2. Tiers",
      "## 3. Prerequisites",
      "## 4. Bring-up and install",
      "## 5. The throwaway project",
      "## 6. Tiers 0, 1, and 1.5: the free tiers, and the gate",
      "## 7. Tier 2: one scout task and one ship task, with a real model",
      "## 8. Hard-rule checks to run in the lab",
      "## 9. What this check does not cover",
      "## 10. Teardown and the \"firstmate was undisturbed\" checklist",
      "## 11. Record the results",
    ]);
    expect(tableRows(section(text, "### Tier 0 checks")).map((row) => row[0])).toEqual([
      "The plugin's command",
      "The protection checklist",
      "The import dry run",
      "The import apply",
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
    const expectedGaps = [/real forge/, /second enrolled machine/, /answering the merge form/, /Cost data/, /same name/, /tier 2 run/, /Pi ship task/, /no-mistakes pipeline run with a real agent/, /read a credential from the environment of the lab's keeper process/];
    expect(gaps).toHaveLength(expectedGaps.length);
    expectedGaps.forEach((pattern, index) => expect(gaps[index], `gap ${index + 1}`).toMatch(pattern));
    expect(gaps[7]).toContain("D-134");

    const teardown = section(text, "## 10.");
    expect(commandLines(teardown)).toEqual(["bblab down", "bblab-evidence snap after", "bblab-evidence diff before after"]);
    expect(teardown).toContain("a tripwire count of zero");
    expect(teardown).toContain("the shared no-mistakes daemon at the same process ID and active");

    expect(text).toContain("**Scout task.**");
    expect(text).toContain("**Ship task.**");
  });

  it("[A1109] names only plugin commands, flags, machines, tools, and bb commands that exist", async () => {
    const text = runbook();
    const world = await loadWorld();
    const registered = new Set((world.host.harness.inspection.registrations.cli?.commands ?? []).map((command) => command.name));
    const allowedFlags: Record<string, string[]> = {
      preflight: ["--project", "--provider"],
      "import-registry": ["--file", "--apply", "--project", "--base-branch"],
      protection: [],
      supervisor: [],
      "supervisor start": ["--project", "--profile", "--prompt"],
      "dispatch init": ["--provider", "--project", "--model", "--level", "--mode"],
    };
    const calls = [...text.matchAll(/bb factoryman ([a-z-]+)([^\n`|)]*)/g)];
    expect(calls.length).toBeGreaterThan(4);
    for (const [, command = "", rest = ""] of calls) {
      expect(registered, command).toContain(command);
      // The lab's one machine is named after the host, so every preflight call reads the name (live check finding 5.3).
      if (command === "preflight") expect(rest.trim(), "a preflight call names the machine from $MACHINE").toMatch(/^"\$MACHINE"(\s|$)/);
      // The stamp form `supervisor <thread>` takes no flag, `supervisor start` takes three, and `dispatch init` takes five.
      const form = command === "supervisor" && /^\s+start\b/.test(rest) ? "supervisor start" : command === "dispatch" && /^\s+init\b/.test(rest) ? "dispatch init" : command;
      for (const flag of rest.match(/(?<![\w-])--[a-z][a-z-]*/g) ?? []) expect(allowedFlags[form], `${form} ${flag}`).toContain(flag);
    }
    // The lab's one machine is named after the host, not server (live check finding 5.3).
    expect(text).not.toMatch(/preflight server\b/);
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

describe("the live-check runbook: tiers and the harnesses", () => {
  it("[A1701] lists tiers 0, 1, 1.5, and 2 with their brain, credential, and spend, and says that no tier 2 run has been done for any harness", () => {
    const text = runbook();
    const tiers = section(text, "## 2.");
    const rows = tableRows(tiers);
    expect(rows.map((row) => row[0])).toEqual(["0", "1", "1.5", "2"]);
    expect(rows.map((row) => row[2])).toEqual(["none", "none", "none", "the credential of the harness under test (section 7)"]);
    expect(rows.map((row) => row[3])).toEqual(["none", "none", "none", "real model spend"]);
    expect(rows[1]?.[1]).toContain("stub");
    expect(rows[2]?.[1]).toContain("fake model");

    expect(tiers).toContain("Run tiers 0, 1, and 1.5 first.");
    expect(tiers).toContain("**No tier 2 run has been done for any harness.**");
    expect(tiers).toContain("The captain has shelved the tier 2 runs for now.");
    const tier2 = section(text, "## 7.");
    expect(prose(tier2)).toContain("**Tier 2 has not been run for any harness.**");
    for (const harness of HARNESSES) expect(tiers, `${harness.title} in the status line`).toContain(harness.title);
    // The old text claimed that nothing ran end to end, as if tiers 1 and 1.5 did not exist.
    expect(text).not.toContain("It never ran a real agent end to end.");
  });

  it("[A1702] gives the tier 1 and tier 1.5 commands for every harness the conformance tool accepts, and never says the stub agent is missing", () => {
    const text = runbook();
    const free = section(text, "## 6.");
    const lines = commandLines(free);
    expect(lines).toContain("pnpm run conformance -- --tier 1");
    for (const harness of HARNESSES) expect(lines, harness.id).toContain(`pnpm run conformance -- --tier 1.5 --harness ${harness.id}`);
    for (const line of lines.filter((candidate) => candidate.startsWith("pnpm run conformance"))) {
      for (const flag of line.match(/(?<![\w-])--[a-z][a-z-]*/g) ?? []) expect(CONFORMANCE_USAGE, flag).toContain(flag);
    }
    expect(CONFORMANCE_USAGE).toContain("<1|1.5>");
    expect(free).toContain("docs/CONFORMANCE.md");
    expect(free).toContain("docs/HARNESS-SUPPORT.md");
    expect(text).not.toContain("That stub agent does not exist yet.");
    expect(text).not.toMatch(/stub agent (does not exist|exists not)/);
    expect(text).not.toContain("Tier 1 skipped");
    expect(text).not.toMatch(/Until the stub agent exists/);
  });

  it("[A1703] gives each of the four harnesses a row with its provider, credential, who creates it, how it enters the lab, and its project mode, and only the captain creates a credential", () => {
    const text = runbook();
    const rows = tableRows(section(text, "### Pick the harness"));
    expect(rows.map((row) => row[0])).toEqual(HARNESSES.map((harness) => harness.title));
    rows.forEach((row, index) => {
      expect(row, `row ${index}`).toHaveLength(6);
      expect(row[1], `provider of ${row[0]}`).toBe(`\`${HARNESSES[index]?.provider}\``);
      expect(row[2], `credential of ${row[0]}`).toMatch(/`(CLAUDE_CODE_OAUTH_TOKEN|OPENAI_API_KEY)`/);
      expect(row[3], `creator of ${row[0]}`).toBe("the captain");
      expect(row[4], `entry of ${row[0]}`).toContain("BBLAB_PASS_ENV");
    });
    expect(rows[0]?.[2]).toContain("CLAUDE_CODE_OAUTH_TOKEN");
    for (const row of rows.slice(1)) expect(row[2]).toContain("OPENAI_API_KEY");

    const create = section(text, "### Create the credential");
    expect(create).toContain("Only the captain creates a credential.");
    expect(create).toContain("No agent creates, reads, or handles a credential while you set it up.");
  });

  it("[A1704] agrees with the contract table on the Pi refusal, the permission modes, and which harnesses need a clear after a stamp", () => {
    const text = runbook();
    const tier2 = section(text, "## 7.");
    const rows = tableRows(section(text, "### Pick the harness"));
    const pi = rows.find((row) => row[0] === "Pi") ?? [];
    expect(contractFor("pi").refusedModes).toEqual(["local-only"]);
    expect(contractFor("pi").workerModes).toEqual(["full"]);
    expect(pi[5]).toContain("`direct-PR`");
    expect(pi[5]).toContain("scout task only");
    expect(pi[5]).toContain("offers only `full`");
    for (const row of rows.filter((candidate) => candidate[0] !== "Pi")) expect(row[5], `${row[0]} project mode`).toContain("`local-only`");
    for (const harness of HARNESSES.filter((candidate) => candidate.id !== "pi")) expect(contractFor(harness.provider).refusedModes, harness.title).toEqual([]);

    const clear = HARNESSES.filter((harness) => contractFor(harness.provider).roleChange === "clear").map((harness) => harness.title);
    const next = HARNESSES.filter((harness) => contractFor(harness.provider).roleChange === "next-turn").map((harness) => harness.title);
    expect(clear).toEqual(["Codex", "omp"]);
    expect(next).toEqual(["Claude Code", "Pi"]);
    expect(prose(tier2)).toContain(`On ${clear.join(" and ")}, run \`bb thread clear <thread>\` after the stamp.`);
    expect(prose(tier2)).toContain(`On ${next.join(" and ")}, the stamp applies on the next turn.`);
    expect(text).not.toContain("from the thread's next session");
    expect(text).not.toMatch(/on the first turn/);
  });

  it("[A1705] writes the starter dispatch config before the supervisor starts, and starts the supervisor with a profile and no fixed provider", () => {
    const text = runbook();
    const tier2 = commandLines(section(text, "## 7."));
    const init = tier2.findIndex((line) => line.includes("bb factoryman dispatch init"));
    const start = tier2.findIndex((line) => line.includes("bb factoryman supervisor start"));
    expect(init).toBeGreaterThanOrEqual(0);
    expect(start).toBeGreaterThan(init);
    expect(tier2[init]).toContain('--provider "$PROVIDER"');
    expect(tier2[init]).toContain('--project "$PROJ"');
    expect(tier2[init]).toContain("--model <cheapest model>");
    expect(tier2[init]).toContain("--level <lowest level>");
    expect(tier2[start]).toContain('--project "$PROJ" --profile "$PROVIDER"');
    expect(tier2.some((line) => line.includes("bb thread spawn"))).toBe(false);
    expect(tier2.join("\n")).not.toMatch(/--provider (claude-code|codex|pi|acp-omp)/);
    expect(commandLines(section(text, "## 5."))).toContain("PROVIDER=claude-code");

    const choose = prose(section(text, "## 5."));
    expect(choose).toContain("The plugin picks no harness for you (D-112).");
    expect(choose).toContain("`dispatch init` names the profile after the provider.");
    expect(prose(section(text, "## 7."))).toContain("bb factoryman supervisor start");
  });

  it("[A1708] keeps Claude wording out of the shared steps, so the Claude path is one row and one block", () => {
    const text = runbook();
    for (const heading of ["## 1.", "## 3.", "## 4.", "## 5.", "## 6.", "## 8.", "## 10.", "## 11."]) expect(section(text, heading), heading).not.toMatch(/Claude/);
    expect(text).not.toContain("Read your Claude usage");
    expect(text).not.toMatch(/Haiku-class/);
    expect(text).not.toMatch(/--provider claude-code/);
    expect(text).not.toMatch(/the Claude CLI inside the lab/);
    // Every harness has its own words only where the behavior differs: the order line, the Claude Code row, the setup sentence, the credential block, the role-change sentence, and the tool-route sentence.
    const claudeLines = prose(section(text, "## 7.")).split("\n").filter((line) => /Claude/.test(line));
    const expected = [/^The order in the report is Claude Code,/, /^\| Claude Code \|/, /^For Claude Code, the captain runs/, /^For Claude Code, enter the credential/, /^On Claude Code and Pi,/, /Claude Code lists it as a deferred tool/];
    expect(claudeLines).toHaveLength(expected.length);
    expected.forEach((pattern, index) => expect(claudeLines[index], `Claude line ${index + 1}`).toMatch(pattern));
  });
});

describe("the live-check runbook: the funding decision and the credential", () => {
  it("[A1111] funds Claude Code from the captain's account and the other harnesses from one capped OpenAI key, says that Claude competes with firstmate, and has only the captain create a credential", () => {
    const text = runbook();
    const tiers = section(text, "## 2.");
    expect(tiers).toContain("Claude Code is funded by the captain's own Claude account (D-092).");
    expect(tiers).toContain("Codex, Pi, and omp are funded by one dedicated OpenAI API key with a provider-side dollar cap (D-108).");
    expect(tiers).toContain("The Claude run competes with firstmate for the same quota windows, so keep it short and cheap.");
    expect(tiers).not.toMatch(/Tier 2 needs a decision from you/);

    const setup = sentences(prose(text)).filter((sentence) => sentence.includes("claude setup-token"));
    expect(setup.length).toBeGreaterThan(0);
    for (const sentence of setup) expect(sentence, "only the captain runs setup-token").toMatch(/^(Only the captain runs|For Claude Code, the captain runs)/);
  });

  it("[A1114] puts no credential in a file, a command line, or an agent's hands: the shell blocks name each credential on fixed lines, and nothing else does", () => {
    const text = runbook();
    const naming = (line: string) => /CLAUDE_CODE_OAUTH_TOKEN|OPENAI_API_KEY|setup-token|BBLAB_PASS_ENV/.test(line);
    const allowed = [
      "read -rs CLAUDE_CODE_OAUTH_TOKEN",
      "export CLAUDE_CODE_OAUTH_TOKEN",
      `export BBLAB_PASS_ENV="${CLAUDE_VARIABLES}"`,
      "read -rs OPENAI_API_KEY",
      "export OPENAI_API_KEY",
      `export BBLAB_PASS_ENV="${OPENAI_VARIABLES}"`,
      "unset CLAUDE_CODE_OAUTH_TOKEN OPENAI_API_KEY BB_CLAUDE_CODE_EXECUTABLE BBLAB_PASS_ENV BBLAB_RO",
    ];
    const lines = commandLines(text).filter(naming);
    expect(lines).toEqual(allowed);
    // No comment in a block hands a credential over either.
    const raw = shell(text).flatMap((fence) => fence.code.split("\n")).filter((line) => /setup-token|provider console/.test(line));
    expect(raw).toEqual([
      "read -rs CLAUDE_CODE_OAUTH_TOKEN          # paste the token that `claude setup-token` printed, then press Enter",
      "read -rs OPENAI_API_KEY                   # paste the key from your provider console, then press Enter",
    ]);

    // No assignment of any kind, quoted or not, and no secret-shaped literal anywhere in the file.
    expect(text).not.toMatch(/CLAUDE_CODE_OAUTH_TOKEN\s*=/);
    expect(text).not.toMatch(/OPENAI_API_KEY\s*=/);
    expect(text).not.toMatch(/\b\w*(TOKEN|KEY)\w*\s*=\s*["']?[A-Za-z0-9_-]{8,}/);
    expect(text).not.toMatch(/sk-ant-[A-Za-z0-9_-]{8,}|sk-[A-Za-z0-9]{16,}|gh[pousr]_[A-Za-z0-9]{8,}|github_pat_|oauth_token:|Bearer\s+\S{8,}/);
    for (const line of lines) expect(line, "a redirect, a pipe, or a substitution on a credential line").not.toMatch(/[<>|]|\$\(|`|\bcat\b|\becho\b|\bprintf\b|\btee\b/);

    // The variable list that reaches the lab is exactly what the harness CLI needs.
    const passed = lines.filter((line) => line.startsWith("export BBLAB_PASS_ENV=")).map((line) => (line.match(/"([^"]*)"/)?.[1] ?? "").split(" ").sort());
    expect(passed).toEqual([CLAUDE_VARIABLES.split(" ").sort(), OPENAI_VARIABLES.split(" ").sort()]);

    // Prose: any sentence that puts a credential and an agent, a thread, a prompt, or a chat together must forbid it.
    // The part that says what can read the credential is a disclosure and not an instruction, so it is the one part that is exempt.
    const disclosure = new Set(sentences(section(text, "### What can read the credential")));
    for (const sentence of sentences(prose(text)).filter((candidate) => !disclosure.has(candidate))) {
      if (!/\b(token|key|credential)s?\b/i.test(sentence) || !/\b(agent|supervisor|worker|thread|prompt|chat)\b/i.test(sentence)) continue;
      expect(sentence, "a sentence that hands a credential to an agent").toMatch(NEGATION);
    }
    expect(prose(text)).toContain("No agent creates, reads, or handles a credential while you set it up.");
    expect(prose(text)).toContain("Do not paste a credential into a chat, a file, or a command line.");

    // A credential lives only in a fresh shell, and the run ends with revoking it.
    const tier2 = section(text, "## 7.");
    const block = commandLines(tier2);
    const order = ["bblab down", 'env -i HOME="$HOME" PATH="$PATH" TERM="$TERM" BBLAB_DIR="$BBLAB_DIR" EVIDENCE_DIR="$EVIDENCE_DIR" PROJ="$PROJ" PROVIDER="$PROVIDER" HARNESS_CLI="$HARNESS_CLI" bash --noprofile --norc', "read -rs CLAUDE_CODE_OAUTH_TOKEN", "read -rs OPENAI_API_KEY", "bblab up"].map((line) => block.indexOf(line));
    expect(order.every((index) => index >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    const stop = section(tier2, "### Stop and clean up the credential");
    expect(commandLines(stop)).toEqual(['kill "$WATCHDOG"', "bblab down", "unset CLAUDE_CODE_OAUTH_TOKEN OPENAI_API_KEY BB_CLAUDE_CODE_EXECUTABLE BBLAB_PASS_ENV BBLAB_RO", "exit"]);
    expect(prose(stop)).toContain("Then revoke the credential in the account that issued it");
  });

  it("[A1124] says what can read the credential, and has the run start from a fresh shell", () => {
    const part = section(runbook(), "### What can read the credential");
    expect(part).toContain("may be able to read the credential from its environment");
    expect(part).toContain("Revoke the credential when the run ends");
    expect(part).toContain("Run tier 2 from a fresh shell that holds only what the run needs");
  });
});

describe("the live-check runbook: spend caps and the gate", () => {
  it("[A1112] carries the spend caps, and the values that the owner runs match them", () => {
    const text = runbook();
    const caps = tableRows(section(text, "### Spend caps"));
    expect(caps.map((row) => row[0])).toEqual(["The cheapest model", "A low reasoning level", "One worker at a time", "Two tasks", "A tiny repository", "A wall-clock limit", "The hard stop"]);
    const how = new Map(caps.map((row) => [row[0], row[1] ?? ""]));
    expect(how.get("The cheapest model")).toContain("cheapest model that `bblab x bb provider models <provider>` lists");
    expect(how.get("A low reasoning level")).toContain("lowest level");
    expect(how.get("A low reasoning level")).toContain("--level");
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
    expect(tier2.find((line) => line.includes("bb factoryman dispatch init"))).toContain("--level <lowest level>");
    expect(tier2).toContain('(sleep 1800 && bblab down) > "$BBLAB_DIR/logs/watchdog.txt" 2>&1 &');
    expect(tier2).toContain("WATCHDOG=$!");
    expect(prose(section(text, "### Spend caps"))).toContain("Keep the ship task in `local-only` mode");
  });

  it("[A1113] runs tiers 0, 1, and 1.5 first, makes tier 2 wait for them, and states the four conditions of the gate", () => {
    const text = runbook();
    const tiers = section(text, "## 2.");
    expect(tiers).toContain("Run tiers 0, 1, and 1.5 first.");
    expect(tiers).toContain("**Tier 2 waits for tiers 0, 1, and 1.5.**");

    const gate = section(text, "### The gate");
    expect(gate).toContain("**Do not start tier 2 until** all of this holds:");
    const items = gate.split("\n").filter((line) => /^\d+\. /.test(line));
    const expected = [/Every tier 0 check passed, and `pnpm run check` passed/, /Tier 1 passed, and tier 1\.5 passed for the harness you will run\./, /`bblab status` shows a tripwire count of zero/, /You have read the caps in section 7/];
    expect(items).toHaveLength(expected.length);
    expected.forEach((pattern, index) => expect(items[index], `gate condition ${index + 1}`).toMatch(pattern));
    expect(gate).not.toContain("That skip is your decision.");

    // A credential enters only in section 7, after the section that holds the gate.
    expect(text.indexOf("## 6. Tiers 0, 1, and 1.5")).toBeLessThan(text.indexOf("## 7. Tier 2"));
    expect(text.indexOf("BBLAB_PASS_ENV")).toBeGreaterThan(text.indexOf("## 7. Tier 2"));
    expect(text.indexOf("read -rs")).toBeGreaterThan(text.indexOf("## 7. Tier 2"));
  });
});

describe("the live-check runbook: steps that a reader can follow without asking", () => {
  it("[A1122] sets the project mode with a script that leaves yolo off, and drives the supervisor with bb thread tell", () => {
    const text = runbook();
    const script = fences(section(text, "## 5.")).find((fence) => fence.code.includes("project_config"));
    expect(script, "the script that writes the project config").toBeDefined();
    expect(script?.code).toContain("VALUES (?, ?, 0, NULL, ?, NULL)");
    expect(script?.code).toContain(".run('$PROJ', '$MODE', 'main')");
    expect(script?.code).toContain("/plugins/bb-factoryman/data.db");
    const vars = commandLines(section(text, "## 5."));
    expect(vars).toContain("MODE=local-only");
    expect(prose(section(text, "## 5."))).toContain("For Pi, set `MODE=direct-PR`");

    const tier2 = commandLines(section(text, "## 7."));
    expect(tier2.filter((line) => line.includes("bb thread tell")).length).toBeGreaterThanOrEqual(1);
    expect(tier2.findIndex((line) => line.includes("bb factoryman supervisor start"))).toBeLessThan(tier2.findIndex((line) => line.includes("bb thread tell")));
    // The old sentence ("from the thread's next session") was wrong for Codex and omp (D-125, report task H4).
    expect(prose(section(text, "## 7."))).toContain("The stamp applies when the harness builds a new session for the thread.");
    expect(prose(section(text, "## 7."))).toContain("If a person created the supervisor thread, stamp it with `bb factoryman supervisor <thread>` instead.");
  });

  it("[A1123] reads the usage of each funding account before and after tier 2 and compares it with the caps", () => {
    const text = runbook();
    expect(section(text, "## 3.")).toContain("Read the usage page of each account that funds the run and write the numbers down.");
    const teardown = section(text, "## 10.");
    expect(teardown).toContain("Read the usage of each account again and compare it with the numbers from section 3.");
    expect(teardown).toContain("The difference must match the caps in section 7.");
  });
});
