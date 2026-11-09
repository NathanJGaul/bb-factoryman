import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { START_USAGE } from "../../src/tools/supervisor-start";
import { fences, section } from "../fixtures/markdown";

const design = (): string => readFileSync(new URL("../../docs/DESIGN.md", import.meta.url), "utf8");
const source = (path: string): string => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

describe("docs/DESIGN.md: dispatch profiles and harness independence", () => {
  it("[A1709] names the readiness statuses, the admission code, the contract table, the roles block, the supervisor start command, the clear advice, and the validator observation, and each name exists in the code", () => {
    const text = section(design(), "## Dispatch profiles");
    const availability = source("src/dispatch/availability.ts");
    for (const status of ["ready", "not_installed", "unauthenticated", "expired", "unsupported_version"]) {
      expect(text, `status ${status}`).toContain(`\`${status}\``);
      expect(availability, `status ${status} in the code`).toContain(`"${status}"`);
    }
    expect(text).toContain("`provider_not_admitted`");
    expect(source("src/dispatch/gate.ts")).toContain('"provider_not_admitted"');
    expect(text).toContain("`no_default_profile`");
    expect(text).toContain("`src/harness/contracts.ts`");
    expect(source("src/harness/contracts.ts")).toContain("export const CONTRACTS");

    expect(text).toContain("`roles.supervisor.profile`");
    expect(source("src/dispatch/config.ts")).toContain("supervisor: z.strictObject({ profile: nonBlank.optional() })");
    expect(text).toContain("`roles.validator.agent`");
    expect(text).toContain("`observe`");

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
