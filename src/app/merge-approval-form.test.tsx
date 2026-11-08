// @vitest-environment jsdom
import { act, cleanup, fireEvent, screen, within } from "@testing-library/react";
import { renderSlot } from "@get-bb/plugin-sdk/testing/app";
import { afterEach, describe, expect, it } from "vitest";
import { REQUEST, deferred, formHarness, type FormOptions } from "../../test/fixtures/approval-form";
import { MergeApprovalForm } from "./merge-approval-form";

afterEach(cleanup);

function mount(options: FormOptions = {}) {
  const harness = formHarness(options);
  const slot = renderSlot({ component: MergeApprovalForm }, harness.props);
  return { ...harness, slot };
}

/** The value element that follows a label in the request's description list. */
function valueOf(label: string): HTMLElement {
  const term = screen.getByText(label, { selector: "dt" });
  const value = term.nextElementSibling;
  if (!(value instanceof HTMLElement)) throw new Error(`no value after ${label}`);
  return value;
}

const button = (name: string) => screen.getByRole("button", { name });
const comment = () => screen.getByRole("textbox");

describe("MergeApprovalForm: the request", () => {
  it("[U1220] shows the task id and the branch under their labels, in a monospace face", () => {
    mount();
    expect(valueOf("Task").textContent).toBe(REQUEST.taskId);
    expect(valueOf("Task").className).toContain("font-mono");
    expect(valueOf("Branch").textContent).toBe(REQUEST.branch);
    expect(valueOf("Branch").className).toContain("font-mono");
  });

  it("[U1221] shows an http pull request URL and an https one as links to that URL", () => {
    for (const url of ["https://github.com/acme/widgets/pull/7", "http://forge.example/acme/widgets/pull/7"]) {
      cleanup();
      mount({ payload: { ...REQUEST, prUrl: url } });
      const link = within(valueOf("Pull request")).getByRole("link", { name: url });
      expect(link.getAttribute("href")).toBe(url);
    }
  });

  it("[U1223] shows None for an empty pull request and for empty evidence, and still offers Approve", () => {
    mount({ payload: { ...REQUEST, prUrl: "", evidence: "" } });
    expect(valueOf("Pull request").textContent).toBe("None");
    expect(valueOf("Evidence").textContent).toBe("None");
    expect(button("Approve").hasAttribute("disabled")).toBe(false);
  });

  it("[U1224] shows the evidence with its line breaks kept", () => {
    mount();
    const evidence = valueOf("Evidence");
    expect(evidence.textContent).toBe(REQUEST.evidence);
    expect(evidence.className).toContain("whitespace-pre-wrap");
  });
});

describe("MergeApprovalForm: Approve", () => {
  it("[U1225] submits { decision: approved } once when Approve is pressed", async () => {
    const { submit } = mount();
    await act(async () => {
      fireEvent.click(button("Approve"));
    });
    expect(submit).toHaveBeenCalledTimes(1);
    expect(submit.mock.calls[0]?.[0]).toStrictEqual({ decision: "approved" });
  });

  it("[U1226] submits the trimmed comment with Approve, and leaves out a blank comment", async () => {
    const typed = mount();
    fireEvent.change(comment(), { target: { value: "  Looks good.  " } });
    await act(async () => {
      fireEvent.click(button("Approve"));
    });
    expect(typed.submit.mock.calls[0]?.[0]).toStrictEqual({ decision: "approved", comment: "Looks good." });

    cleanup();
    const blank = mount();
    fireEvent.change(comment(), { target: { value: "   " } });
    await act(async () => {
      fireEvent.click(button("Approve"));
    });
    expect(blank.submit.mock.calls[0]?.[0]).toStrictEqual({ decision: "approved" });
  });
});

describe("MergeApprovalForm: an answer in flight", () => {
  const group = () => screen.getByRole("group", { name: "Merge approval request" });

  it("[U1229] enables the controls before a press, disables them while submit is pending, and keeps them disabled once it resolves", async () => {
    const held = deferred();
    mount({ submit: () => held.promise });
    const controls = () => [...screen.getAllByRole("button"), comment()];
    expect(controls().every((control) => !control.hasAttribute("disabled"))).toBe(true);
    expect(group().getAttribute("aria-busy")).not.toBe("true");

    await act(async () => {
      fireEvent.click(button("Approve"));
    });
    expect(controls().every((control) => control.hasAttribute("disabled"))).toBe(true);
    expect(group().getAttribute("aria-busy")).toBe("true");

    await act(async () => {
      held.resolve();
    });
    expect(controls().every((control) => control.hasAttribute("disabled"))).toBe(true);
  });

  it("[U1230] sends no second answer for a second press while the first is pending", async () => {
    const held = deferred();
    const { submit } = mount({ submit: () => held.promise });
    await act(async () => {
      fireEvent.click(button("Approve"));
    });
    await act(async () => {
      fireEvent.click(button("Approve"));
    });
    expect(submit).toHaveBeenCalledTimes(1);
  });
});
