import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TOOL_NAMES } from "../../src/tools/register";
import { loadWorld } from "../fixtures/plugin-host";

/** Read inside each test, so a missing runbook fails every test and not the whole file at once. */
const runbook = (): string => readFileSync(new URL("../../docs/LIVE-CHECK.md", import.meta.url), "utf8");

describe("the live-check runbook", () => {
  it("[A1107] says not to install into the owner's bb, never to touch the shared no-mistakes daemon, and to use the throwaway bb of the isolation report", () => {
    const text = runbook();
    expect(text).toMatch(/Do not install the plugin into your own bb/);
    expect(text).toMatch(/Never start, stop, or restart the shared no-mistakes daemon/);
    expect(text).toMatch(/bblab/);
    expect(text).toMatch(/live-isolation scout report/);
    expect(text).toMatch(/bb-factoryman-live-isolation\/report\.md/);
    expect(text).not.toMatch(/bb plugin install[^\n]*~\/\.bb/);
  });

  it("[A1108] holds the tiers, the bring-up, the tier 0 checks, a scout task, a ship task, the hard-rule checks, the teardown checklist, and what stays unverified", () => {
    const text = runbook();
    for (const heading of ["## 2. Tiers", "## 4. Bring-up and install", "## 6. Tier 0 checks", "## 7. Tier 2", "## 8. Hard-rule checks", "## 9. What this check does not cover", "## 10. Teardown"]) {
      expect(text, heading).toContain(heading);
    }
    expect(text).toMatch(/\*\*Scout task\.\*\*/);
    expect(text).toMatch(/\*\*Ship task\.\*\*/);
    for (const item of ["A pull request URL from another repository", "`local-only` work on another machine", "empty evidence"]) expect(text, item).toContain(item);
    for (const gap of ["real forge", "second enrolled machine", "answering the merge form", "same name"]) expect(text, gap).toContain(gap);
  });

  it("[A1109] names only plugin commands and tools that exist", async () => {
    const text = runbook();
    const world = await loadWorld();
    const registered = new Set((world.host.harness.inspection.registrations.cli?.commands ?? []).map((command) => command.name));
    const commands = new Set([...text.matchAll(/bb factoryman ([a-z-]+)/g)].map((match) => match[1] as string));
    expect(commands.size).toBeGreaterThan(2);
    for (const command of commands) expect(registered, command).toContain(command);
    for (const tool of new Set(text.match(/factoryman_[a-z_]+/g) ?? [])) expect(TOOL_NAMES, tool).toContain(tool);
  });

  it("[A1111] funds tier 2 from the captain's own Claude account, says that it competes with firstmate, and has the captain run claude setup-token and pass the token through BBLAB_PASS_ENV", () => {
    const text = runbook();
    expect(text).toMatch(/captain's own Claude account/);
    expect(text).toMatch(/competes with firstmate for the same quota/);
    expect(text).toMatch(/claude setup-token/);
    expect(text).toMatch(/BBLAB_PASS_ENV="?CLAUDE_CODE_OAUTH_TOKEN/);
    expect(text).toMatch(/Only the captain runs `claude setup-token`/);
  });

  it("[A1112] carries the spend caps: the cheapest model, a low reasoning level, one worker at a time, a tiny repository, a wall-clock limit, and bblab down as the hard stop", () => {
    const text = runbook();
    expect(text).toMatch(/cheapest model/i);
    expect(text).toMatch(/low reasoning level/i);
    expect(text).toMatch(/one worker at a time/i);
    expect(text).toMatch(/"maxWorkers": 1/);
    expect(text).toMatch(/"maxTasksPerDay": 2/);
    expect(text).toMatch(/tiny repository/i);
    expect(text).toMatch(/sleep 1800 && bblab down/);
    expect(text).toMatch(/hard stop/i);
  });

  it("[A1113] runs tiers 0 and 1 first, makes tier 2 wait for them, and says what the gate is while the tier 1 stub agent does not exist", () => {
    const text = runbook();
    expect(text).toMatch(/Run tiers 0 and 1 first/);
    expect(text).toMatch(/Tier 2 waits for tiers 0 and 1/);
    expect(text).toMatch(/stub agent/i);
    expect(text).toMatch(/does not exist yet/i);
    expect(text).toMatch(/Do not start tier 2 until/);
    // The credential enters the lab only for tier 2, after tiers 0 and 1 passed without it.
    expect(text.indexOf("## 6. Tier 0 checks")).toBeLessThan(text.indexOf("## 7. Tier 2"));
    expect(text.indexOf("bblab down")).toBeLessThan(text.indexOf("BBLAB_PASS_ENV"));
  });

  it("[A1114] holds no token, never asks an agent to create, read, or handle the token, and never puts it in a file or on a command line", () => {
    const text = runbook();
    expect(text).not.toMatch(/sk-ant-[A-Za-z0-9_-]{8,}/);
    expect(text).not.toMatch(/CLAUDE_CODE_OAUTH_TOKEN=[^\s"$]/);
    expect(text).not.toMatch(/oauth_token:/);
    expect(text).toMatch(/read -rs CLAUDE_CODE_OAUTH_TOKEN/);
    expect(text).toMatch(/No agent creates, reads, or handles the token/);
    expect(text).toMatch(/Do not paste the token into a chat, a file, or a command line/);
    expect(text).toMatch(/unset CLAUDE_CODE_OAUTH_TOKEN/);
  });
});
