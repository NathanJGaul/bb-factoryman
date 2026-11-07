import { describe, expect, it } from "vitest";
import { DISPATCH, loadWorld } from "../fixtures/plugin-host";

const PR = "https://github.com/acme/widgets/pull/7";
const worker = { threadId: "thr-w1" };

async function worldFor(kind: "ship" | "scout", mode: "no-mistakes" | "direct-PR" | "local-only") {
  const world = await loadWorld();
  world.setProject({ deliveryMode: mode });
  await world.call("factoryman_dispatch", { ...DISPATCH, kind });
  return world;
}

describe("factoryman_report through the plugin factory", () => {
  it("[A6] records handoff, ready, or report as the kind and mode require, block or fail for those outcomes, and a refusal for empty evidence", async () => {
    const scout = await worldFor("scout", "no-mistakes");
    expect((await scout.call("factoryman_report", { outcome: "done", evidence: "Report body." }, worker)).text).toBe("Task t1 is now report_ready.");

    const handoff = await worldFor("ship", "no-mistakes");
    await handoff.call("factoryman_report", { outcome: "done", evidence: "Committed." }, worker);
    expect(handoff.store.getTask("t1")?.state).toBe("validating");

    const direct = await worldFor("ship", "direct-PR");
    await direct.call("factoryman_report", { outcome: "done", evidence: "PR open.", prUrl: PR }, worker);
    expect(direct.store.getTask("t1")).toMatchObject({ state: "review_ready", pullRequestUrl: PR });

    const local = await worldFor("ship", "local-only");
    await local.call("factoryman_report", { outcome: "done", evidence: "Landed.", landedCommits: 2 }, worker);
    expect(local.store.getTask("t1")?.state).toBe("review_ready");

    const blocked = await worldFor("ship", "no-mistakes");
    await blocked.call("factoryman_report", { outcome: "blocked", evidence: "Needs a token." }, worker);
    expect(blocked.store.getTask("t1")?.state).toBe("blocked");

    const failed = await worldFor("ship", "no-mistakes");
    await failed.call("factoryman_report", { outcome: "failed", evidence: "Cannot build." }, worker);
    expect(failed.store.getTask("t1")?.state).toBe("failed");

    const blank = await worldFor("ship", "no-mistakes");
    const refused = await blank.call("factoryman_report", { outcome: "done", evidence: " " }, worker);
    expect(refused.isError).toBe(true);
    expect(refused.text).toContain("evidence_required");
    expect(blank.store.listEvents({ taskId: "t1" }).at(-1)).toMatchObject({ outcome: "refused", reasonCode: "evidence_required" });
  });
});
