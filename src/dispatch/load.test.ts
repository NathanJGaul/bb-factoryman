import { describe, expect, it } from "vitest";
import { FakeFiles } from "../../test/fixtures/files";
import { emptyDispatchConfig } from "./config";
import { loadDispatchConfig } from "./load";

const PATH = "/work/repo/.bb/factoryman/dispatch.json";
const GOOD = JSON.stringify({ version: 1, profiles: {}, rules: [] });

describe("loadDispatchConfig", () => {
  it("[U736] gives an empty config for an absent file", async () => {
    const files = new FakeFiles();
    expect(await loadDispatchConfig(files, "/work/repo")).toEqual({ ok: true, config: emptyDispatchConfig() });
  });

  it("[U737] gives an empty config for an unknown checkout and reads nothing", async () => {
    const files = new FakeFiles();
    expect(await loadDispatchConfig(files, null)).toEqual({ ok: true, config: emptyDispatchConfig() });
    expect(files.reads).toEqual([]);
  });

  it("[U738] blocks invalid JSON with the parse error", async () => {
    const files = new FakeFiles();
    files.files.set(PATH, "{ nope");
    const result = await loadDispatchConfig(files, "/work/repo");
    expect(result).toMatchObject({ ok: false });
    expect(result.ok ? "" : result.message).toMatch(/dispatch\.json is not valid JSON/);
  });

  it("[U739] blocks a schema failure with the first issue and its path", async () => {
    const files = new FakeFiles();
    files.files.set(PATH, JSON.stringify({ version: 1, profiles: {}, rules: [{ id: "r", when: { kind: "ship" }, profile: "ghost" }] }));
    const result = await loadDispatchConfig(files, "/work/repo");
    expect(result.ok ? "" : result.message).toMatch(/dispatch\.json is invalid: .*ghost.* at `rules\.0\.profile`/);
  });

  it("[U740] blocks a read error that is not a missing file", async () => {
    const files = new FakeFiles();
    files.errors.set(PATH, new Error("EACCES: permission denied"));
    const result = await loadDispatchConfig(files, "/work/repo");
    expect(result.ok ? "" : result.message).toMatch(/could not read dispatch\.json: EACCES/);
  });

  it("[U741] reads <checkout>/.bb/factoryman/dispatch.json and returns the parsed config", async () => {
    const files = new FakeFiles();
    files.files.set(PATH, GOOD);
    const result = await loadDispatchConfig(files, "/work/repo");
    expect(files.reads).toEqual([PATH]);
    expect(result).toMatchObject({ ok: true, config: { version: 1, rules: [] } });
  });
});
