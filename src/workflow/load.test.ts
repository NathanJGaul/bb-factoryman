import { describe, expect, it } from "vitest";
import { FakeFiles } from "../../test/fixtures/files";
import { emptyWorkflowConfig } from "./config";
import { loadWorkflowConfig } from "./load";

const PATH = "/work/repo/.bb/factoryman/workflow.json";

describe("loadWorkflowConfig", () => {
  it("[U907] gives the empty config for an absent file and for an unknown checkout", async () => {
    const files = new FakeFiles();
    expect(await loadWorkflowConfig(files, "/work/repo")).toEqual({ ok: true, config: emptyWorkflowConfig() });
    expect(await loadWorkflowConfig(files, null)).toEqual({ ok: true, config: emptyWorkflowConfig() });
    expect(files.reads).toEqual([PATH]);
  });

  it("[U908] blocks invalid JSON, a schema failure, and a read error with a message that names workflow.json", async () => {
    const files = new FakeFiles();
    files.files.set(PATH, "{ nope");
    expect((await loadWorkflowConfig(files, "/work/repo")).ok).toBe(false);
    const json = await loadWorkflowConfig(files, "/work/repo");
    expect(json.ok ? "" : json.message).toMatch(/workflow\.json is not valid JSON/);
    files.files.set(PATH, JSON.stringify({ version: 1, yolo: true }));
    const schema = await loadWorkflowConfig(files, "/work/repo");
    expect(schema.ok ? "" : schema.message).toMatch(/workflow\.json is invalid: .*never remove a gate/);
    files.errors.set(PATH, new Error("EACCES: permission denied"));
    const read = await loadWorkflowConfig(files, "/work/repo");
    expect(read.ok ? "" : read.message).toMatch(/could not read workflow\.json: EACCES/);
  });

  it("[U909] reads <checkout>/.bb/factoryman/workflow.json and returns the parsed config", async () => {
    const files = new FakeFiles();
    files.files.set(PATH, JSON.stringify({ version: 1, project: { branchPrefix: "wip/" } }));
    expect(await loadWorkflowConfig(files, "/work/repo")).toMatchObject({ ok: true, config: { project: { branchPrefix: "wip/" } } });
    expect(files.reads).toEqual([PATH]);
  });
});
