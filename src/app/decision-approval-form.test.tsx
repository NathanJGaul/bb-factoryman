// @vitest-environment jsdom
import { act, cleanup, fireEvent, screen, within } from "@testing-library/react";
import { renderSlot } from "@get-bb/plugin-sdk/testing/app";
import { afterEach, describe, expect, it } from "vitest";
import type { DecisionAnswer, DecisionFinding, DecisionRequestPayload } from "../approval/contract";
import { ALL_CONTROLS, deferred, disabledControls, formHarness, press, typeComment as type, valueOf, type FormOptions } from "../../test/fixtures/approval-form";
import { DecisionApprovalForm } from "./decision-approval-form";

afterEach(cleanup);

const finding = (id: string, overrides: Partial<DecisionFinding> = {}): DecisionFinding => ({ id, severity: "error", file: "sum.js", action: id === "review-2" ? "ask-user" : "auto-fix", description: `Problem ${id}.\nSecond line.`, ...overrides });
const answer = (overrides: Partial<DecisionAnswer> = {}): DecisionAnswer => ({ action: "approve", findingIds: [], instructions: "", ...overrides });
const GATE = (overrides: Partial<DecisionRequestPayload> = {}): DecisionRequestPayload => ({
  taskId: "t-abc12345",
  key: "nm-01M6SKG1YZY54AJVFKK02MVXWH-review-0a1b2c3d",
  kind: "gate",
  step: "review",
  status: "awaiting_approval",
  outcome: "",
  findings: [finding("review-1"), finding("review-2")],
  answer: answer(),
  ...overrides,
});
const FINISHED: DecisionRequestPayload = { taskId: "t-abc12345", key: "nm-r1-passed-with-override-0a1b2c3d", kind: "finished", step: "", status: "", outcome: "passed-with-override", findings: [], answer: answer({ action: "rerun" }) };

function mount(payload: unknown = GATE(), options: FormOptions = {}) {
  const harness = formHarness({ title: "Approve the answer for task t-abc12345", ...options, payload });
  const slot = renderSlot({ component: DecisionApprovalForm }, harness.props);
  return { ...harness, slot };
}
const button = (name: string) => screen.getByRole("button", { name });
const comment = () => screen.getByRole("textbox");
const group = () => screen.getByRole("group", { name: "Decision approval request" });

describe("DecisionApprovalForm: what the owner approves", () => {
  it("[U1828] shows the task, the key, the step, and the status", () => {
    mount();
    expect(valueOf("Task").textContent).toBe("t-abc12345");
    expect(valueOf("Task").className).toContain("font-mono");
    expect(valueOf("Key").textContent).toBe("nm-01M6SKG1YZY54AJVFKK02MVXWH-review-0a1b2c3d");
    expect(valueOf("Step").textContent).toBe("review");
    expect(valueOf("Status").textContent).toBe("awaiting_approval");
  });

  it("[U1828] shows every finding with its ID, severity, file, action, and full description", () => {
    mount();
    const list = screen.getByRole("list", { name: "Findings" });
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]?.textContent).toContain("review-1");
    expect(items[0]?.textContent).toContain("error");
    expect(items[0]?.textContent).toContain("sum.js");
    expect(items[0]?.textContent).toContain("auto-fix");
    expect(items[0]?.textContent).toContain("Problem review-1.\nSecond line.");
    expect(items[1]?.textContent).toContain("ask-user");
  });

  it("[U1828] scrolls a long list of findings instead of growing without a limit", () => {
    mount(GATE({ findings: Array.from({ length: 40 }, (_, index) => finding(`review-${index + 1}`)) }));
    const list = screen.getByRole("list", { name: "Findings" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(40);
    expect(list.className).toContain("overflow-y-auto");
    expect(list.className).toContain("max-h-");
  });

  it.each([
    ["approve", answer({ action: "approve" }), /Approve this step and continue the pipeline\./],
    ["skip", answer({ action: "skip" }), /Skip this step and continue the pipeline\./],
    ["fix of one finding", answer({ action: "fix", findingIds: ["review-2"], instructions: "Use a parameterized query." }), /Have the pipeline fix review-2\./],
    ["fix of two findings", answer({ action: "fix", findingIds: ["review-1", "review-2"] }), /Have the pipeline fix review-1, review-2\./],
  ])("[U1828] states the answer for %s", (_name, chosen, sentence) => {
    mount(GATE({ answer: chosen }));
    expect(valueOf("Answer that will be sent").textContent).toMatch(sentence);
  });

  it("[U1828] shows the finding IDs and the instructions of a fix exactly, and None when there are no instructions", () => {
    mount(GATE({ answer: answer({ action: "fix", findingIds: ["review-1", "review-2"], instructions: "Use a query.\nKeep the API." }) }));
    expect(valueOf("Findings to fix").textContent).toBe("review-1, review-2");
    expect(valueOf("Instructions").textContent).toBe("Use a query.\nKeep the API.");
    expect(valueOf("Instructions").className).toContain("whitespace-pre-wrap");
    cleanup();
    mount(GATE({ answer: answer({ action: "fix", findingIds: ["review-1"] }) }));
    expect(valueOf("Instructions").textContent).toBe("None");
  });

  it("[U1828] shows no fix rows for approve and skip", () => {
    mount();
    expect(screen.queryByText("Findings to fix", { selector: "dt" })).toBeNull();
    expect(screen.queryByText("Instructions", { selector: "dt" })).toBeNull();
  });

  it("[U1828] shows None for a gate with no findings, and still offers Approve", () => {
    mount(GATE({ findings: [] }));
    expect(screen.queryByRole("list", { name: "Findings" })).toBeNull();
    expect(screen.getByText("No findings are listed for this gate.")).toBeTruthy();
    expect(button("Approve").hasAttribute("disabled")).toBe(false);
  });

  it("[U1829] shows the outcome of a finished run, no findings list, and a sentence that approval starts a new run", () => {
    mount(FINISHED);
    expect(valueOf("Outcome").textContent).toBe("passed-with-override");
    expect(screen.queryByText("Step", { selector: "dt" })).toBeNull();
    expect(screen.queryByRole("list", { name: "Findings" })).toBeNull();
    expect(valueOf("Answer that will be sent").textContent).toMatch(/Start a new no-mistakes run for this task\./);
  });
});

describe("DecisionApprovalForm: a payload it cannot read", () => {
  it.each([
    ["null", null],
    ["a string", "text"],
    ["an array", []],
    ["a payload with an extra key", { ...GATE(), extra: "x" }],
    ["a fix of a finding that is not shown", GATE({ answer: answer({ action: "fix", findingIds: ["review-9"] }) })],
    ["a rerun on a gate", GATE({ answer: answer({ action: "rerun" }) })],
  ])("[U1830] shows an alert and no Approve for %s, and Deny and Cancel still work", async (_name, payload) => {
    const { submit, cancel } = mount(payload);
    expect(screen.getByRole("alert").textContent).toMatch(/unreadable.*Approve is not offered/);
    expect(screen.queryByRole("button", { name: "Approve" })).toBeNull();
    expect(screen.queryByText("Task", { selector: "dt" })).toBeNull();
    await press("Deny");
    expect(submit.mock.calls[0]?.[0]).toStrictEqual({ decision: "denied" });
    cleanup();
    const second = mount(payload);
    await press("Cancel");
    expect(second.cancel).toHaveBeenCalledTimes(1);
    expect(cancel).not.toHaveBeenCalled();
  });
});

describe("DecisionApprovalForm: the owner's decision", () => {
  it("[U1831] submits { decision: approved } once when Approve is pressed, with the trimmed comment", async () => {
    const { submit } = mount();
    type("  Looks right.  ");
    expect((comment() as HTMLTextAreaElement).value).toBe("  Looks right.  ");
    await press("Approve");
    expect(submit).toHaveBeenCalledTimes(1);
    expect(submit.mock.calls[0]?.[0]).toStrictEqual({ decision: "approved", comment: "Looks right." });
  });

  it("[U1831] leaves out a blank comment", async () => {
    const { submit } = mount();
    type("   ");
    await press("Approve");
    expect(submit.mock.calls[0]?.[0]).toStrictEqual({ decision: "approved" });
  });

  it("[U1831] submits { decision: denied } with the trimmed comment when Deny is pressed", async () => {
    const { submit } = mount();
    type("  Not this fix.  ");
    await press("Deny");
    expect(submit).toHaveBeenCalledTimes(1);
    expect(submit.mock.calls[0]?.[0]).toStrictEqual({ decision: "denied", comment: "Not this fix." });
  });

  it("[U1831] calls cancel once when Cancel is pressed, and never calls submit", async () => {
    const { submit, cancel } = mount();
    await press("Cancel");
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(submit).not.toHaveBeenCalled();
  });

  it("[U1831] disables every control while an answer is pending, and sends one answer for two presses in one batch", async () => {
    const held = deferred();
    const { submit } = mount(GATE(), { submit: () => held.promise });
    expect(disabledControls()).toEqual([]);
    await act(async () => {
      fireEvent.click(button("Approve"));
      fireEvent.click(button("Approve"));
    });
    expect(submit).toHaveBeenCalledTimes(1);
    expect(disabledControls()).toEqual(ALL_CONTROLS);
    expect(group().getAttribute("aria-busy")).toBe("true");
    await act(async () => held.resolve());
    expect(disabledControls()).toEqual(ALL_CONTROLS);
  });

  it("[U1831] shows the reason and enables the controls again when the answer fails", async () => {
    const { submit } = mount(GATE(), {
      submit: async () => {
        throw new Error("bb is not reachable");
      },
    });
    await press("Approve");
    expect(screen.getByRole("alert").textContent).toBe("Your answer was not sent: bb is not reachable");
    expect(disabledControls()).toEqual([]);
    await press("Approve");
    expect(submit).toHaveBeenCalledTimes(2);
  });

  it("[U1831] names the comment field and the three buttons", () => {
    mount();
    expect(screen.getByLabelText("Comment (optional)")).toBe(comment());
    expect(screen.getAllByRole("button").map((control) => control.textContent)).toEqual(["Approve", "Deny", "Cancel"]);
  });

  it("[U1831] shows when the form expires", () => {
    mount(GATE(), { expiresAt: Date.UTC(2026, 10, 8, 15, 30) });
    expect(document.querySelector("time")?.getAttribute("datetime")).toBe("2026-11-08T15:30:00.000Z");
  });
});

describe("DecisionApprovalForm: text from the validator", () => {
  it("[U1832] shows a description with markup as text and creates no element for it", () => {
    const description = '<img src="x" onerror="alert(1)"> **bold** <script>alert(2)</script>';
    const { slot } = mount(GATE({ findings: [finding("review-1", { description }), finding("review-2")], answer: answer({ action: "fix", findingIds: ["review-1"], instructions: "<b>now</b>" }) }));
    expect(slot.container.querySelector("img")).toBeNull();
    expect(slot.container.querySelector("script")).toBeNull();
    expect(slot.container.querySelector("b")).toBeNull();
    expect(within(screen.getByRole("list", { name: "Findings" })).getAllByRole("listitem")[0]?.textContent).toContain(description);
    expect(valueOf("Instructions").textContent).toBe("<b>now</b>");
  });
});
