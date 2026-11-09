import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { tmpDir } from "../../test/fixtures/git-repo.ts";
import { loadGaps, parseGaps } from "./gaps.ts";

const entry = { check: "S1.remedy", harness: "*", task: "H1", reason: "dispatch does not read providerStates yet" };
const text = (value: unknown) => JSON.stringify(value);

describe("parseGaps", () => {
  it("[U1312] reads a valid file into entries with check, harness, task, and reason", () => {
    expect(parseGaps(text({ version: 1, gaps: [entry, { ...entry, check: "S7.cause", harness: "codex", task: "H3" }] }))).toEqual([entry, { ...entry, check: "S7.cause", harness: "codex", task: "H3" }]);
  });

  it("[U1313] rejects an entry with no report task or no reason", () => {
    expect(() => parseGaps(text({ version: 1, gaps: [{ ...entry, task: "" }] }))).toThrow(/task/);
    expect(() => parseGaps(text({ version: 1, gaps: [{ check: entry.check, harness: "*", reason: "x" }] }))).toThrow(/task/);
    expect(() => parseGaps(text({ version: 1, gaps: [{ ...entry, reason: "  " }] }))).toThrow(/reason/);
  });

  it("[U1314] rejects an unknown field and a check id that is not S<number>.<name>", () => {
    expect(() => parseGaps(text({ version: 1, gaps: [{ ...entry, owner: "me" }] }))).toThrow(/owner/);
    expect(() => parseGaps(text({ version: 1, gaps: [{ ...entry, check: "readiness" }] }))).toThrow(/check/);
    expect(() => parseGaps(text({ version: 1, gaps: [{ ...entry, check: "S1" }] }))).toThrow(/check/);
    expect(() => parseGaps(text({ version: 1, gaps: [{ ...entry, task: "later" }] }))).toThrow(/task/);
  });

  it("[U1315] rejects two entries for the same check and harness, and allows the same check for two harnesses", () => {
    expect(() => parseGaps(text({ version: 1, gaps: [entry, entry] }))).toThrow(/duplicate/i);
    expect(parseGaps(text({ version: 1, gaps: [entry, { ...entry, harness: "codex" }] }))).toHaveLength(2);
  });
});

describe("loadGaps", () => {
  it("[U1316] treats a missing file as an error and not as an empty list", async () => {
    await expect(loadGaps(join(tmpdir(), "no-such-dir-conformance", "known-gaps.json"))).rejects.toThrow(/known-gaps/);
    const dir = tmpDir("gaps-");
    const file = join(dir, "known-gaps.json");
    writeFileSync(file, text({ version: 1, gaps: [] }));
    await expect(loadGaps(file)).resolves.toEqual([]);
  });
});

describe("the committed known-gap file", () => {
  const committed = () => loadGaps(new URL("../../conformance/known-gaps.json", import.meta.url).pathname);

  it("[U1519] lists no entry for the checks that the harness contracts closed: S1.unready-blocks, S1.remedy, and S7.cause", async () => {
    const checks = (await committed()).map((gap) => gap.check);
    for (const closed of ["S1.unready-blocks", "S1.remedy", "S7.cause"]) expect(checks, closed).not.toContain(closed);
  });

  it("[U1717] lists no entry at all, because the supervisor start command closed the last gaps, and loadGaps returns an empty list", async () => {
    expect(await committed()).toEqual([]);
  });
});
