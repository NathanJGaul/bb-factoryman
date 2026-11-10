import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { ProviderState } from "../../src/bb/port";
import { parseDispatchConfig } from "../../src/dispatch/config";
import { readinessProblem } from "../../src/dispatch/availability";
import { gateProfile } from "../../src/dispatch/gate";
import { contractFor, CONTRACTS } from "../../src/harness/contracts";
import { roleAdvice } from "../../src/harness/advice";
import { preflightReport } from "../../src/machines/preflight";
import { describeObservation, READ_SCRIPT } from "../../src/validator/agent";
import type { Exec } from "../../src/exec";
import type { Profile } from "../../src/machine/types";
import { FakeBbPort, modelEntry, providerState } from "../fixtures/bb-port";
import { START_USAGE } from "../../src/tools/supervisor-start";
import { fences, section } from "../fixtures/markdown";

const design = (): string => readFileSync(new URL("../../docs/DESIGN.md", import.meta.url), "utf8");
const state = (status: ProviderState["status"]): ProviderState => ({ providerId: "p", status, installedVersion: null, minimumSupportedVersion: null, localLoginCommand: null, statusMessage: null });
const PI: Profile = { provider: "pi", model: "openai/gpt-6-luna", reasoningLevel: "medium", permissionMode: "full" };
function piBb(): FakeBbPort {
  const bb = new FakeBbPort();
  bb.providers = [{ id: "pi", available: true, permissionModes: ["full"], reasoningLevels: ["low", "medium", "high"] }];
  bb.models.set("pi", { models: [modelEntry("openai/gpt-6-luna", { reasoningLevels: ["low", "medium", "high"] })], loadError: null });
  return bb;
}
/** The text from one bold paragraph label to the next one, so a claim is tied to the paragraph that makes it. */
const between = (text: string, from: string, to: string): string => text.split(from)[1]?.split(to)[0] ?? "";

describe("docs/DESIGN.md: dispatch profiles and harness independence", () => {
  it("[A1709] names the readiness statuses, the admission code, the contract table, the roles block, the supervisor start command, the clear advice, and the validator observation, and each name exists in the code", async () => {
    const text = section(design(), "## Dispatch profiles");
    // The code treats each status as the document says: only `ready` passes, and each other status blocks and names itself.
    for (const status of ["ready", "not_installed", "unauthenticated", "expired", "unsupported_version"] as const) {
      expect(text, `status ${status}`).toContain(`\`${status}\``);
      const problem = readinessProblem("p", [state(status)], "the host");
      if (status === "ready") expect(problem).toBeNull();
      else expect(problem, `status ${status} in the code`).toContain(`(bb status: ${status}`);
    }
    expect(text).toContain("`provider_not_admitted`");
    const refused = await gateProfile(piBb(), PI, "local-only", null);
    expect(refused).toMatchObject({ ok: false, code: "provider_not_admitted", permanent: true });
    expect(text).toContain("`no_default_profile`");
    expect(text).toContain("`src/harness/contracts.ts`");
    expect(CONTRACTS.map((row) => row.provider)).toContain("claude-code");
    expect(contractFor("claude-code")).toBe(CONTRACTS.find((row) => row.provider === "claude-code"));

    // The roles block: stated in its own paragraph and again in the supervisor paragraph, and the code accepts the field.
    const roles = between(text, "**Roles.**", "**Supervisor start.**");
    expect(roles).toContain("`roles.supervisor.profile`");
    expect(roles).toContain("`roles.validator.agent`");
    expect(roles).toContain("`observe`");
    expect(between(text, "**Supervisor start.**", "**Validator observation.**")).toContain("`roles.supervisor.profile`");
    const accepted = parseDispatchConfig({ version: 1, profiles: { p: { provider: "x", model: "m", reasoningLevel: "low", permissionMode: "auto" } }, rules: [], roles: { supervisor: { profile: "p" }, validator: { agent: "observe" } } });
    expect(accepted.ok && accepted.config.roles).toEqual({ supervisor: { profile: "p" }, validator: { agent: "observe" } });

    expect(text).toContain("`bb factoryman supervisor start`");
    for (const flag of ["--project", "--profile", "--prompt"]) {
      expect(text, `flag ${flag}`).toContain(`\`${flag}\``);
      expect(START_USAGE, `flag ${flag} in the usage`).toContain(flag);
    }
    expect(text).toContain("`bb factoryman supervisor <thread>`");
    expect(text).toContain("`bb thread clear`");
    expect(roleAdvice("thr-1", "codex", contractFor("codex"))).toContain("`bb thread clear thr-1`");

    expect(text).toContain("never writes");
    expect(text).toContain("`config.yaml`");
    expect(READ_SCRIPT).toContain("config.yaml");
    expect(describeObservation({ status: "unobserved", reason: "r" }, "h")).toContain("could not be observed");
    expect(text).toContain("`validator_agent`");
    const bb = new FakeBbPort();
    bb.states = [providerState("claude"), providerState("codex", { status: "unauthenticated", localLoginCommand: "codex login" })];
    const exec: Exec = async (_command, args) => ({ code: 0, stdout: args[1] === READ_SCRIPT ? "agent: codex\n" : "", stderr: "" });
    const report = await preflightReport({ bb, exec }, { host: { id: "h", name: "box", status: "connected", phase: "active", online: true }, sourcePath: "/w", mode: "no-mistakes", provider: "claude" });
    expect(report.problems.map((problem) => problem.check)).toContain("validator_agent");
  });

  it("[A1710] says the supervisor has five tools, has a profile example that parses, and has no unavailable-provider wording", () => {
    const text = design();
    expect(section(text, "## Supervisor thread")).toContain("The plugin gives the supervisor five tools.");
    expect(section(text, "## Supervisor thread")).not.toContain("gives it five tools");
    expect(section(text, "## Supervisor thread")).not.toContain("gives the supervisor four tools");
    expect(text).not.toMatch(/unavailable provider/i);
    expect(text).toContain("a provider that bb does not report `ready`");
    expect(section(text, "## Machines and domain leads")).toContain("so that bb reports its provider `ready`");
    // The profile example is data and parses as the dispatch config the plugin reads.
    const json = fences(section(text, "## Dispatch profiles")).find((fence) => fence.lang === "json");
    expect(json).toBeDefined();
    expect(JSON.parse(json?.code ?? "null")).toMatchObject({ version: 1, roles: { supervisor: { profile: expect.any(String) } } });
  });
});
