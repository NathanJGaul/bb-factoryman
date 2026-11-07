import { describe, expect, it } from "vitest";
import { buildWorkerPrompt, type PromptInput } from "./prompt";

const base: PromptInput = { taskId: "k1", kind: "ship", mode: "no-mistakes", branch: "fm/k1", description: "Add a --json flag." };

describe("buildWorkerPrompt", () => {
  it("[U29] names the task ID, kind, mode, branch, description, and the report tool", () => {
    const prompt = buildWorkerPrompt(base);
    for (const part of ["k1", "ship", "no-mistakes", "fm/k1", "Add a --json flag.", "factoryman_report"]) {
      expect(prompt).toContain(part);
    }
  });

  it("[U30] tells a no-mistakes worker never to push", () => {
    expect(buildWorkerPrompt(base)).toMatch(/never push/i);
    expect(buildWorkerPrompt({ ...base, mode: "direct-PR" })).not.toMatch(/never push/i);
  });

  it("[U31] asks a direct-PR worker for an open pull request and a local-only worker for landed commits", () => {
    expect(buildWorkerPrompt({ ...base, mode: "direct-PR" })).toMatch(/pull request URL/);
    expect(buildWorkerPrompt({ ...base, mode: "local-only" })).toMatch(/landedCommits/);
    expect(buildWorkerPrompt({ ...base, kind: "scout" })).toMatch(/report/i);
  });

  it("[U32] tells every worker not to contact the owner", () => {
    for (const mode of ["no-mistakes", "direct-PR", "local-only"] as const) {
      expect(buildWorkerPrompt({ ...base, mode })).toMatch(/do not contact the owner/i);
    }
    expect(buildWorkerPrompt({ ...base, kind: "scout" })).toMatch(/do not contact the owner/i);
  });
});
