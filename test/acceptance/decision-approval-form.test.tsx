// @vitest-environment jsdom
import { cleanup, screen, within } from "@testing-library/react";
import { loadPluginApp, renderSlot } from "@get-bb/plugin-sdk/testing/app";
import { afterEach, describe, expect, it } from "vitest";
import { DECISION_RENDERER_ID, MERGE_RENDERER_ID } from "../../src/approval/contract";
import { approvalAnswerSchema } from "../../src/tools/merge";
import { decisionKey } from "../../src/validator/key";
import { GATE, KEY, disposeWorlds, finding, ok, parked, view } from "../fixtures/decision-world";
import { formHarness, press, typeComment as type, valueOf } from "../fixtures/approval-form";
import { nextForm, type World } from "../fixtures/plugin-host";

afterEach(async () => {
  cleanup();
  await disposeWorlds();
});

/**
 * Mount the renderer that the frontend registered for the open form, the way bb does: find it by the form's renderer id,
 * and wire `submit` and `cancel` to the form's answer. `submitted` records every answer that reaches bb.
 */
async function mountRenderer(world: World, formId: string, options: { payload?: unknown } = {}) {
  const app = await loadPluginApp(() => import("../../src/app"));
  const request = world.host.harness.inspection.pendingInteractions.find((pending) => pending.id === formId);
  if (request === undefined) throw new Error("the form is not open");
  const registration = app.pendingInteractions.find((candidate) => candidate.id === request.rendererId);
  if (registration === undefined) throw new Error(`no renderer is registered for ${request.rendererId}`);
  const submitted: unknown[] = [];
  const { props } = formHarness({
    id: formId,
    threadId: request.threadId,
    title: request.title,
    payload: "payload" in options ? options.payload : request.payload,
    submit: async (value) => {
      submitted.push(value);
      world.host.harness.behavior.submitInteraction(formId, value);
    },
    cancel: async () => world.host.harness.behavior.cancelInteraction(formId),
  });
  const { container } = renderSlot(registration, props);
  return { submitted, request, container };
}

const FIX = { taskId: "t1", key: KEY, action: "fix", findingIds: ["review-2"], instructions: "Use a parameterized query." } as const;

describe("the decision form through the plugin factory and the registered renderer", () => {
  it("[A1814] shows the findings and the exact answer that factoryman_decide opened, and its Approve gives the reply that the tool accepts", async () => {
    const { world, validator } = await parked();
    validator.script("answer", [ok(view())]);
    const call = world.call("factoryman_decide", FIX);
    const formId = await nextForm(world);
    const { submitted, request } = await mountRenderer(world, formId);
    expect(request.rendererId).toBe(DECISION_RENDERER_ID);
    expect(valueOf("Task").textContent).toBe("t1");
    expect(valueOf("Key").textContent).toBe(KEY);
    expect(valueOf("Step").textContent).toBe("review");
    const items = within(screen.getByRole("list", { name: "Findings" })).getAllByRole("listitem");
    expect(items.map((item) => item.textContent)).toEqual(GATE.gate!.findings.map((entry) => expect.stringContaining(entry.description)));
    expect(valueOf("Answer that will be sent").textContent).toContain("Have the pipeline fix review-2.");
    expect(valueOf("Findings to fix").textContent).toBe("review-2");
    expect(valueOf("Instructions").textContent).toBe("Use a parameterized query.");
    type("  Approved in the form.  ");
    await press("Approve");
    expect(submitted).toStrictEqual([{ decision: "approved", comment: "Approved in the form." }]);
    expect(approvalAnswerSchema.safeParse(submitted[0]).success).toBe(true);
    const result = await call;
    expect(result.isError, result.text).toBe(false);
    expect(validator.calls.filter((entry) => entry.operation === "answer")).toHaveLength(1);
    expect(world.store.getTask("t1")?.state).toBe("validating");
  });

  it("[A1814] sends nothing when Deny is pressed, and nothing when Cancel is pressed", async () => {
    const denied = await parked();
    const call = denied.world.call("factoryman_decide", FIX);
    await mountRenderer(denied.world, await nextForm(denied.world));
    await press("Deny");
    expect((await call).isError).toBe(true);
    expect(denied.validator.calls.filter((entry) => entry.operation === "answer")).toEqual([]);
    cleanup();

    const cancelled = await parked();
    const second = cancelled.world.call("factoryman_decide", FIX);
    await mountRenderer(cancelled.world, await nextForm(cancelled.world));
    await press("Cancel");
    expect((await second).isError).toBe(true);
    expect(cancelled.validator.calls.filter((entry) => entry.operation === "answer")).toEqual([]);
  });

  it("[A1815] still renders the merge payload with the merge renderer, and keeps the two ids apart", async () => {
    const app = await loadPluginApp(() => import("../../src/app"));
    const merge = app.pendingInteractions.find((registration) => registration.id === MERGE_RENDERER_ID);
    expect(merge).toBeDefined();
    const { props } = formHarness();
    renderSlot(merge!, props);
    expect(valueOf("Pull request").textContent).toBe("https://github.com/acme/widgets/pull/7");
    expect(screen.queryByText("Key", { selector: "dt" })).toBeNull();
    expect(MERGE_RENDERER_ID).not.toBe(DECISION_RENDERER_ID);
  });

  it("[A1821] shows markup from a finding as text, and for an unreadable payload shows an alert and no Approve while Deny still works", async () => {
    const markup = '<img src="x" onerror="alert(1)">';
    const live = view({ phase: "gate", gate: { step: "review", status: "awaiting_approval", findings: [{ ...finding("review-1"), description: markup }] } });
    const { world, validator } = await parked({ live });
    const call = world.call("factoryman_decide", { taskId: "t1", key: decisionKey(live), action: "approve" });
    const formId = await nextForm(world);
    const shown = await mountRenderer(world, formId);
    expect(shown.container.querySelector("img")).toBeNull();
    expect(screen.getByRole("list", { name: "Findings" }).textContent).toContain(markup);
    cleanup();

    const broken = await mountRenderer(world, formId, { payload: { ...(shown.request.payload as object), extra: "x" } });
    expect(screen.getByRole("alert").textContent).toMatch(/unreadable.*Approve is not offered/);
    expect(screen.queryByRole("button", { name: "Approve" })).toBeNull();
    await press("Deny");
    expect(broken.submitted).toStrictEqual([{ decision: "denied" }]);
    const result = await call;
    expect(result.isError).toBe(true);
    expect(validator.calls.filter((entry) => entry.operation === "answer")).toEqual([]);
  });
});
