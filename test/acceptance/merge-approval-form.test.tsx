// @vitest-environment jsdom
import { act, cleanup, fireEvent, screen, within } from "@testing-library/react";
import { loadPluginApp, renderSlot } from "@get-bb/plugin-sdk/testing/app";
import { afterEach, describe, expect, it } from "vitest";
import { MERGE_RENDERER_ID } from "../../src/approval/contract";
import { deferred } from "../fixtures/approval-form";
import { DISPATCH, loadWorld, nextForm, type World } from "../fixtures/plugin-host";

const PR = "https://github.com/acme/widgets/pull/7";
const worker = { threadId: "thr-w1" };

afterEach(cleanup);

/** A direct-PR ship task at review_ready, as in tools-merge.test.ts. */
async function readyWorld(): Promise<World> {
  const world = await loadWorld();
  world.setProject({ deliveryMode: "direct-PR", yolo: false });
  await world.call("factoryman_dispatch", DISPATCH);
  await world.call("factoryman_report", { outcome: "done", evidence: "PR open.\nTests pass.", prUrl: PR }, worker);
  expect(world.store.getTask("t1")?.state).toBe("review_ready");
  return world;
}

const merges = (world: World) => world.execCalls.filter((call) => call.command === "gh");
const state = (world: World) => world.store.getTask("t1")?.state;
const approvals = (world: World) => world.store.listApprovals("t1");

interface OpenForm {
  /** The tool call that waits for the owner's answer. */
  call: ReturnType<World["call"]>;
  id: string;
}

/** Make the supervisor ask for the merge, and wait until bb holds the form. */
async function openForm(world: World): Promise<OpenForm> {
  const call = world.call("factoryman_merge", { taskId: "t1" });
  return { call, id: await nextForm(world) };
}

/**
 * Mount the renderer that the frontend registered for the open form, the way bb does:
 * find it by the form's renderer id, and wire `submit` and `cancel` to the form's answer.
 * `submitted` records every answer that reaches bb.
 */
async function mountRenderer(world: World, form: OpenForm, options: { holdSubmit?: Promise<void> } = {}) {
  const app = await loadPluginApp(() => import("../../src/app"));
  const request = world.host.harness.inspection.pendingInteractions.find((pending) => pending.id === form.id);
  if (request === undefined) throw new Error("the form is not open");
  const registration = app.pendingInteractions.find((candidate) => candidate.id === request.rendererId);
  if (registration === undefined) throw new Error(`no renderer is registered for ${request.rendererId}`);
  const submitted: unknown[] = [];
  renderSlot(registration, {
    interaction: { id: form.id, threadId: request.threadId, title: request.title, payload: request.payload, createdAt: 1_700_000_000_000, expiresAt: null },
    submit: async (value) => {
      submitted.push(value);
      await options.holdSubmit;
      world.host.harness.behavior.submitInteraction(form.id, value);
    },
    cancel: async () => {
      world.host.harness.behavior.cancelInteraction(form.id);
    },
  });
  return { submitted, request };
}

const press = async (name: string) => {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name }));
  });
};
const type = (value: string) => fireEvent.change(screen.getByRole("textbox"), { target: { value } });

describe("the merge approval form through the plugin factory and the registered renderer", () => {
  it("[A1201] registers exactly one pending-interaction renderer, under the id that factoryman_merge passes", async () => {
    const world = await readyWorld();
    const app = await loadPluginApp(() => import("../../src/app"));
    expect(app.pendingInteractions.map((registration) => registration.id)).toEqual([MERGE_RENDERER_ID]);
    const form = await openForm(world);
    const request = world.host.harness.inspection.pendingInteractions.find((pending) => pending.id === form.id);
    expect(request?.rendererId).toBe(app.pendingInteractions[0]?.id);
    world.host.harness.behavior.cancelInteraction(form.id);
    await form.call;
  });

  it("[A1202] shows the task id, branch, pull request, and evidence of the request that factoryman_merge opened", async () => {
    const world = await readyWorld();
    const form = await openForm(world);
    await mountRenderer(world, form);
    const branch = world.store.getTask("t1")?.branch ?? "";
    expect(branch).not.toBe("");
    const value = (label: string) => screen.getByText(label, { selector: "dt" }).nextElementSibling as HTMLElement;
    expect(value("Task").textContent).toBe("t1");
    expect(value("Branch").textContent).toBe(branch);
    expect(within(value("Pull request")).getByRole("link", { name: PR }).getAttribute("href")).toBe(PR);
    expect(value("Evidence").textContent).toBe("PR open.\nTests pass.");
    world.host.harness.behavior.cancelInteraction(form.id);
    await form.call;
  });

  it("[A1203] ends the task merged, with one user approval row that says approved, when Approve is pressed", async () => {
    const world = await readyWorld();
    const form = await openForm(world);
    const { submitted } = await mountRenderer(world, form);
    await press("Approve");
    const result = await form.call;
    expect(submitted).toStrictEqual([{ decision: "approved" }]);
    expect(result.isError).toBe(false);
    expect(merges(world)).toEqual([{ command: "gh", args: ["pr", "merge", PR, "--squash"], cwd: undefined }]);
    expect(state(world)).toBe("merged");
    expect(approvals(world)).toMatchObject([{ scope: "merge", decision: "approved" }]);
    const approvalRows = world.store.listEvents({ taskId: "t1" }).filter((row) => row.event === "record_approval");
    expect(approvalRows).toMatchObject([{ actor: "user", outcome: "applied" }]);
  });

  it("[A1204] carries a typed comment into the approval record, and leaves a blank comment out", async () => {
    const typed = await readyWorld();
    const typedForm = await openForm(typed);
    await mountRenderer(typed, typedForm);
    type("  Reviewed the diff.  ");
    await press("Approve");
    await typedForm.call;
    const withComment = typed.store.listEvents({ taskId: "t1" }).find((row) => row.event === "record_approval");
    expect(withComment?.evidence).toBe("Reviewed the diff.");

    cleanup();
    const blank = await readyWorld();
    const blankForm = await openForm(blank);
    await mountRenderer(blank, blankForm);
    type("   ");
    await press("Approve");
    await blankForm.call;
    const without = blank.store.listEvents({ taskId: "t1" }).find((row) => row.event === "record_approval");
    expect(without).toBeDefined();
    expect(without?.evidence ?? null).toBeNull();
    expect(state(blank)).toBe("merged");
  });

  it("[A1205] disables every control while the answer is in flight, and two presses send one answer", async () => {
    const world = await readyWorld();
    const form = await openForm(world);
    const held = deferred();
    const { submitted } = await mountRenderer(world, form, { holdSubmit: held.promise });
    await press("Approve");
    const controls = [...screen.getAllByRole("button"), screen.getByRole("textbox")];
    expect(controls.every((control) => control.hasAttribute("disabled"))).toBe(true);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    });
    expect(submitted).toHaveLength(1);
    held.resolve();
    await form.call;
    expect(submitted).toHaveLength(1);
    expect(approvals(world)).toHaveLength(1);
    expect(merges(world)).toHaveLength(1);
  });

  it("[A1206] merges nothing, records a denied row, and leaves the task awaiting approval, when Deny is pressed", async () => {
    const world = await readyWorld();
    const form = await openForm(world);
    const { submitted } = await mountRenderer(world, form);
    await press("Deny");
    const result = await form.call;
    expect(submitted).toStrictEqual([{ decision: "denied" }]);
    expect(result.isError).toBe(true);
    expect(merges(world)).toEqual([]);
    expect(state(world)).toBe("awaiting_approval");
    expect(approvals(world)).toMatchObject([{ scope: "merge", decision: "denied" }]);
    const rows = world.store.listEvents({ taskId: "t1" }).filter((row) => row.event === "record_approval");
    expect(rows).toMatchObject([{ actor: "user", outcome: "applied" }]);
  });

  it("[A1207] carries a typed comment into the denial record and the supervisor's result", async () => {
    const world = await readyWorld();
    const form = await openForm(world);
    await mountRenderer(world, form);
    type("  Not before the release.  ");
    await press("Deny");
    const result = await form.call;
    const row = world.store.listEvents({ taskId: "t1" }).find((candidate) => candidate.event === "record_approval");
    expect(row?.evidence).toBe("Not before the release.");
    expect(result.text).toContain("Not before the release.");
    expect(state(world)).toBe("awaiting_approval");
  });

  it("[A1208] records no approval and runs no merge when Cancel is pressed, and a later call opens a new form", async () => {
    const world = await readyWorld();
    const form = await openForm(world);
    await mountRenderer(world, form);
    await press("Cancel");
    const result = await form.call;
    expect(result.isError).toBe(true);
    expect(result.text).toMatch(/did not answer/i);
    expect(merges(world)).toEqual([]);
    expect(state(world)).toBe("awaiting_approval");
    expect(approvals(world)).toEqual([]);

    cleanup();
    const again = await openForm(world);
    await mountRenderer(world, again);
    await press("Approve");
    expect((await again.call).isError).toBe(false);
    expect(state(world)).toBe("merged");
  });
});

