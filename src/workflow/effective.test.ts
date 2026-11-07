import { describe, expect, it } from "vitest";
import { defaultProjectConfig } from "../store/store";
import type { ProjectConfig } from "../store/types";
import { effectiveProject } from "./effective";
import type { WorkflowConfig } from "./types";

const stored = (overrides: Partial<ProjectConfig> = {}): ProjectConfig => ({ ...defaultProjectConfig("proj-1"), ...overrides });
const file = (project: WorkflowConfig["project"]): WorkflowConfig => ({ version: 1, project, checks: {} });

function config(result: ReturnType<typeof effectiveProject>): ProjectConfig {
  if (!result.ok) throw new Error(result.message);
  return result.config;
}

describe("effectiveProject", () => {
  it("[U910] fills a null branch prefix and default machine from the file, and keeps a stored value", () => {
    const filled = config(effectiveProject(stored(), file({ branchPrefix: "wip/", defaultMachine: "gpu-box" })));
    expect(filled).toMatchObject({ branchPrefix: "wip/", defaultMachine: "gpu-box" });
    const kept = config(effectiveProject(stored({ branchPrefix: "fm/", defaultMachine: "local-box" }), file({ branchPrefix: "wip/", defaultMachine: "gpu-box" })));
    expect(kept).toMatchObject({ branchPrefix: "fm/", defaultMachine: "local-box" });
    expect(config(effectiveProject(stored(), file({})))).toEqual(stored());
  });

  it.each([
    ["no-mistakes", "no-mistakes"],
    ["direct-PR", "direct-PR"],
    ["direct-PR", "no-mistakes"],
    ["local-only", "direct-PR"],
    ["local-only", "no-mistakes"],
    ["local-only", "local-only"],
  ] as const)("[U911] applies a file mode that is as strict as the stored mode or stricter: stored %s, file %s", (storedMode, fileMode) => {
    expect(config(effectiveProject(stored({ deliveryMode: storedMode }), file({ deliveryMode: fileMode }))).deliveryMode).toBe(fileMode);
  });

  it.each([
    ["no-mistakes", "direct-PR"],
    ["no-mistakes", "local-only"],
    ["direct-PR", "local-only"],
  ] as const)("[U912] blocks a looser file mode and names both modes: stored %s, file %s", (storedMode, fileMode) => {
    const result = effectiveProject(stored({ deliveryMode: storedMode }), file({ deliveryMode: fileMode }));
    expect(result.ok).toBe(false);
    expect(result.ok ? "" : result.message).toContain(storedMode);
    expect(result.ok ? "" : result.message).toContain(fileMode);
  });

  it("[U913] takes yolo and baseBranch from the store only", () => {
    const result = config(effectiveProject(stored({ yolo: true, baseBranch: "trunk" }), file({ branchPrefix: "wip/" })));
    expect(result).toMatchObject({ yolo: true, baseBranch: "trunk", branchPrefix: "wip/" });
    expect(config(effectiveProject(stored({ yolo: false }), file({}))).yolo).toBe(false);
  });
});
