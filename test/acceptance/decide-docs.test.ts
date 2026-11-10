import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { headingNumbers } from "../fixtures/decision-log";
import { prose, section, tableRows } from "../fixtures/markdown";

const root = new URL("../../", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), "utf8");
const design = () => read("docs/DESIGN.md");
const log = () => read("docs/DECISIONS.md");
const constitution = () => read(".specify/memory/constitution.md");
const skill = () => read("skills/factoryman-supervisor/SKILL.md");

/** The body of one decision, up to the next heading. */
const decision = (number: string): string => log().split(new RegExp(`^### ${number}:`, "m"))[1]?.split(/^### /m)[0] ?? "";

describe("the supervisor skill and factoryman_decide", () => {
  it("[U1836] lists the tool, tells the supervisor to read the key from the wake message, to call the tool, and that the owner approves, and no longer says that a finding cannot be answered", () => {
    const text = skill();
    const tools = tableRows(section(text, "## Your tools")).map((row) => row[0]);
    expect(tools).toContain("`factoryman_decide`");
    const answer = section(text, "## Answer a finding");
    expect(answer).toContain("`factoryman_decide`");
    expect(answer).toContain("Decision key");
    expect(answer).toMatch(/owner approves/);
    expect(answer).toMatch(/form/);
    expect(answer).toContain("`rerun`");
    expect(answer).toMatch(/never reuse an old key/i);
    expect(prose(text)).not.toMatch(/You cannot answer a finding\./);
    const wake = tableRows(section(text, "## What wakes you")).find((row) => row[0] === "`needs_decision`");
    expect(wake?.[1]).toContain("`factoryman_decide`");
    expect(section(text, "## What you cannot do")).toMatch(/approve a decision form/);
  });
});

describe("the design, the log, and the constitution", () => {
  it("[U1840] lists the tool in the supervisor's table, says the supervisor has five tools and a worker a sixth, and names the finding gate", () => {
    const text = design();
    const supervisor = section(text, "## Supervisor thread");
    expect(supervisor).toContain("The plugin gives the supervisor five tools.");
    expect(supervisor).toContain("A worker gets a sixth, `factoryman_report`.");
    const rows = tableRows(supervisor);
    expect(rows.map((row) => row[0])).toContain("`factoryman_decide`");
    expect(rows.find((row) => row[0] === "`factoryman_decide`")?.[2]).toBe("Supervisor");
    const gates = tableRows(section(text, "## Authority gates")).find((row) => row[0] === "Pipeline finding");
    expect(gates?.[2]).toContain("`factoryman_decide`");
    expect(gates?.[2]).toMatch(/only after the owner approves/);
    expect(gates?.[2]).toMatch(/never reads `yolo`/);
    expect(section(text, "## Dispatch profiles")).toContain("its five tools and its skill from the first session");
    expect(text).not.toMatch(/gives the supervisor four tools|has its four tools/);
    expect(text).toContain("The sixth tool, `factoryman_decide`, came later (D-136).");
  });

  it("[U1841] has constitution 1.5.0 without the stays-out clause and with D-136, and the old decisions carry an Amended by line", () => {
    const text = constitution();
    expect(text).toMatch(/\*\*Version\*\*: 1\.5\.0 \| \*\*Ratified\*\*: 2026-11-05 \| \*\*Last amended\*\*: 2026-11-09/);
    const principle = text.split("### VI.")[1]?.split("\n### ")[0] ?? "";
    expect(principle).not.toMatch(/factoryman_decide[^.]*stays out/);
    expect(principle).toContain("`factoryman_decide` is in scope");
    expect(principle).toContain("D-136");
    const numbers = headingNumbers(log());
    for (const number of ["D-136", "D-137", "D-138", "D-139", "D-140", "D-141", "D-142", "D-143", "D-144"]) expect(numbers, number).toContain(number);
    for (const number of ["D-031", "D-057", "D-068", "D-095"]) {
      const named = decision(number).match(/^Amended by (D-\d{3})/m)?.[1];
      expect(named, `${number} has an Amended by line`).toBe("D-136");
    }
  });

  it("[U1842] counts five supervisor tools in the conformance and live-check documents, and adds the decision check to S8", () => {
    const conformance = read("docs/CONFORMANCE.md");
    const rows = tableRows(section(conformance, "## Scenarios"));
    const byId = new Map(rows.map((row) => [row[0], row[1] ?? ""]));
    expect(byId.get("S5")).toContain("A supervisor sees its five tools and its own skill only.");
    expect(byId.get("S8")).toContain("a decision in the wrong state is refused");
    expect(byId.get("S9")).toContain("has its five tools and its skill on its first turn");
    expect(read("docs/LIVE-CHECK.md")).toContain("the thread has the five supervisor tools and the `factoryman-supervisor` skill");
    for (const path of ["docs/CONFORMANCE.md", "docs/LIVE-CHECK.md", "docs/DESIGN.md", "skills/factoryman-supervisor/SKILL.md"]) {
      expect(read(path), path).not.toMatch(/four supervisor tools|supervisor its four tools|supervisor has its four tools/);
    }
  });

  it("[A1819] never calls factoryman_decide out of scope after D-136, in the constitution, the skill, the design, or the project instructions", () => {
    for (const path of [".specify/memory/constitution.md", "skills/factoryman-supervisor/SKILL.md", "docs/DESIGN.md", "CLAUDE.md"]) {
      expect(read(path), path).not.toMatch(/factoryman_decide[^.\n]*(stays out|out of scope|stay out)/i);
    }
    expect(decision("D-136")).toContain("Principle VI");
    expect(decision("D-136")).toContain("1.5.0");
  });
});
