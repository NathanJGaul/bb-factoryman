import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { ProviderState } from "../../src/bb/port";
import { parseDispatchConfig } from "../../src/dispatch/config";
import { readinessProblem } from "../../src/dispatch/availability";
import { START_USAGE } from "../../src/tools/supervisor-start";
import { fences, section } from "../fixtures/markdown";

const design = (): string => readFileSync(new URL("../../docs/DESIGN.md", import.meta.url), "utf8");
const source = (path: string): string => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const state = (status: ProviderState["status"]): ProviderState => ({ providerId: "p", status, installedVersion: null, minimumSupportedVersion: null, localLoginCommand: null, statusMessage: null });
/** The text from one bold paragraph label to the next one, so a claim is tied to the paragraph that makes it. */
const between = (text: string, from: string, to: string): string => text.split(from)[1]?.split(to)[0] ?? "";

describe("docs/DESIGN.md: dispatch profiles and harness independence", () => {
  it("[A1709] names the readiness statuses, the admission code, the contract table, the roles block, the supervisor start command, the clear advice, and the validator observation, and each name exists in the code", () => {
    const text = section(design(), "## Dispatch profiles");
    // The code treats each status as the document says: only `ready` passes, and each other status blocks and names itself.
    for (const status of ["ready", "not_installed", "unauthenticated", "expired", "unsupported_version"] as const) {
      expect(text, `status ${status}`).toContain(`\`${status}\``);
      const problem = readinessProblem("p", [state(status)], "the host");
      if (status === "ready") expect(problem).toBeNull();
      else expect(problem, `status ${status} in the code`).toContain(`(bb status: ${status}`);
    }
    expect(text).toContain("`provider_not_admitted`");
    expect(source("src/dispatch/gate.ts")).toContain('"provider_not_admitted"');
    expect(text).toContain("`no_default_profile`");
    expect(text).toContain("`src/harness/contracts.ts`");
    expect(source("src/harness/contracts.ts")).toContain("export const CONTRACTS");

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
    expect(source("src/harness/advice.ts")).toContain("bb thread clear");

    expect(text).toContain("never writes");
    expect(text).toContain("`config.yaml`");
    expect(source("src/validator/agent.ts")).toContain("config.yaml");
    expect(text).toContain("`validator_agent`");
    expect(source("src/machines/preflight.ts")).toContain('"validator_agent"');
  });

  it("[A1710] says the supervisor has four tools, has a profile example that parses, and has no unavailable-provider wording", () => {
    const text = design();
    expect(section(text, "## Supervisor thread")).toContain("The plugin gives the supervisor four tools.");
    expect(section(text, "## Supervisor thread")).not.toContain("gives it five tools");
    expect(text).not.toMatch(/unavailable provider/i);
    expect(text).toContain("a provider that bb does not report `ready`");
    expect(section(text, "## Machines and domain leads")).toContain("so that bb reports its provider `ready`");
    // The profile example is data and parses as the dispatch config the plugin reads.
    const json = fences(section(text, "## Dispatch profiles")).find((fence) => fence.lang === "json");
    expect(json).toBeDefined();
    expect(JSON.parse(json?.code ?? "null")).toMatchObject({ version: 1, roles: { supervisor: { profile: expect.any(String) } } });
  });
});
