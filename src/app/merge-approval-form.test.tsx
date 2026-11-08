// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
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

describe("MergeApprovalForm: Deny and Cancel", () => {
  it("[U1227] submits { decision: denied } once when Deny is pressed, with the trimmed comment when one is typed", async () => {
    const plain = mount();
    await act(async () => {
      fireEvent.click(button("Deny"));
    });
    expect(plain.submit).toHaveBeenCalledTimes(1);
    expect(plain.submit.mock.calls[0]?.[0]).toStrictEqual({ decision: "denied" });

    cleanup();
    const typed = mount();
    fireEvent.change(comment(), { target: { value: "  Not yet.  " } });
    await act(async () => {
      fireEvent.click(button("Deny"));
    });
    expect(typed.submit).toHaveBeenCalledTimes(1);
    expect(typed.submit.mock.calls[0]?.[0]).toStrictEqual({ decision: "denied", comment: "Not yet." });
  });

  it("[U1228] calls cancel once when Cancel is pressed, and never calls submit", async () => {
    const { submit, cancel } = mount();
    await act(async () => {
      fireEvent.click(button("Cancel"));
    });
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(submit).not.toHaveBeenCalled();
  });

  it("[U1237] labels the comment field and names the Approve, Deny, and Cancel buttons", () => {
    mount();
    expect(screen.getByLabelText("Comment (optional)")).toBe(comment());
    expect(screen.getAllByRole("button").map((control) => control.textContent)).toEqual(["Approve", "Deny", "Cancel"]);
    for (const name of ["Approve", "Deny", "Cancel"]) expect(button(name)).toBeTruthy();
  });
});

describe("MergeApprovalForm: the pull request link", () => {
  it("[U1240] underlines the pull request link so that it reads as a link", () => {
    mount();
    const link = within(valueOf("Pull request")).getByRole("link");
    expect(link.className).toContain("underline");
  });

  it("[U1242] opens the pull request through bb's navigation, so that bb's open-in-app preference applies", () => {
    const { slot } = mount();
    fireEvent.click(within(valueOf("Pull request")).getByRole("link"));
    expect(slot.inspection.navigateCalls).toEqual([{ method: "openUrl", url: REQUEST.prUrl }]);
  });

  it("[U1222] shows a javascript:, ftp:, data:, or non-URL pull request value as plain text with no link", () => {
    for (const value of ["javascript:alert(1)", "ftp://forge.example/pull/7", "data:text/html,<b>x</b>", "not a url", "//forge.example/pull/7"]) {
      cleanup();
      mount({ payload: { ...REQUEST, prUrl: value } });
      const cell = valueOf("Pull request");
      expect(cell.textContent, value).toBe(value);
      expect(within(cell).queryByRole("link"), value).toBeNull();
    }
  });
});

describe("MergeApprovalForm: a failed answer", () => {
  it("[U1231] shows the rejection in an alert, re-enables the controls, and keeps the typed comment", async () => {
    const { submit } = mount({ submit: async () => { throw new Error("bb said no"); } });
    fireEvent.change(comment(), { target: { value: "My reason." } });
    await act(async () => {
      fireEvent.click(button("Approve"));
    });
    expect(screen.getByRole("alert").textContent).toContain("bb said no");
    expect([...screen.getAllByRole("button"), comment()].every((control) => !control.hasAttribute("disabled"))).toBe(true);
    expect((comment() as HTMLTextAreaElement).value).toBe("My reason.");
    expect(screen.getByRole("group", { name: "Merge approval request" }).getAttribute("aria-busy")).not.toBe("true");
    await act(async () => {
      fireEvent.click(button("Deny"));
    });
    expect(submit).toHaveBeenCalledTimes(2);
    expect(submit.mock.calls[1]?.[0]).toStrictEqual({ decision: "denied", comment: "My reason." });
  });

  it("[U1232] shows a rejected cancel in an alert and re-enables the controls", async () => {
    mount({ cancel: async () => { throw new Error("cancel refused"); } });
    await act(async () => {
      fireEvent.click(button("Cancel"));
    });
    expect(screen.getByRole("alert").textContent).toContain("cancel refused");
    expect(screen.getAllByRole("button").every((control) => !control.hasAttribute("disabled"))).toBe(true);
  });
});

describe("MergeApprovalForm: a retry after a failed answer", () => {
  it("[U1241] clears the failure banner when a retry succeeds", async () => {
    let attempts = 0;
    mount({
      submit: async () => {
        attempts += 1;
        if (attempts === 1) throw new Error("bb said no");
      },
    });
    await act(async () => {
      fireEvent.click(button("Approve"));
    });
    expect(screen.getByRole("alert").textContent).toContain("bb said no");
    await act(async () => {
      fireEvent.click(button("Approve"));
    });
    expect(attempts).toBe(2);
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("MergeApprovalForm: a request it cannot read", () => {
  const unreadable: Array<[string, unknown]> = [
    ["null", null],
    ["a field missing", { taskId: REQUEST.taskId, branch: REQUEST.branch, prUrl: REQUEST.prUrl }],
    ["a field of the wrong type", { ...REQUEST, taskId: 7 }],
    ["an extra field", { ...REQUEST, extra: "x" }],
    ["a string", "approve everything"],
  ];

  it("[U1233] shows the unreadable notice, no Approve, and both Deny and Cancel", () => {
    for (const [name, payload] of unreadable) {
      cleanup();
      mount({ payload });
      expect(screen.getByRole("alert").textContent, name).toMatch(/unreadable/i);
      expect(screen.queryByRole("button", { name: "Approve" }), name).toBeNull();
      expect(screen.getByRole("button", { name: "Deny" }), name).toBeTruthy();
      expect(screen.getByRole("button", { name: "Cancel" }), name).toBeTruthy();
    }
  });

  it("[U1234] submits a denial from the unreadable notice, and cancel still cancels", async () => {
    const denied = mount({ payload: null });
    await act(async () => {
      fireEvent.click(button("Deny"));
    });
    expect(denied.submit.mock.calls.map((call) => call[0])).toStrictEqual([{ decision: "denied" }]);

    cleanup();
    const cancelled = mount({ payload: null });
    await act(async () => {
      fireEvent.click(button("Cancel"));
    });
    expect(cancelled.cancel).toHaveBeenCalledTimes(1);
    expect(cancelled.submit).not.toHaveBeenCalled();
  });
});

describe("MergeApprovalForm: expiry, keys, and style", () => {
  it("[U1235] shows the expiry in a time element when expiresAt is set, and no expiry line when it is null", () => {
    const expiresAt = Date.UTC(2026, 10, 8, 15, 30);
    const { container } = mount({ expiresAt }).slot;
    const time = container.querySelector("time");
    expect(time?.getAttribute("datetime")).toBe(new Date(expiresAt).toISOString());
    expect(time?.parentElement?.textContent).toMatch(/^Expires /);

    cleanup();
    const none = mount({ expiresAt: null }).slot;
    expect(none.container.querySelector("time")).toBeNull();
    expect(none.container.textContent).not.toMatch(/Expires/);
  });

  it("[U1236] submits nothing when Enter is pressed in the comment field, which is a multi-line field in no form", () => {
    const { submit, cancel, slot } = mount();
    expect(slot.container.querySelector("form")).toBeNull();
    expect(comment().tagName).toBe("TEXTAREA");
    for (const init of [{ key: "Enter" }, { key: "Enter", ctrlKey: true }, { key: "Enter", metaKey: true }]) {
      fireEvent.keyDown(comment(), init);
      fireEvent.keyUp(comment(), init);
    }
    expect(submit).not.toHaveBeenCalled();
    expect(cancel).not.toHaveBeenCalled();
  });

  it("[U1238] gives the evidence a height limit with its own scroll, and breaks long task, branch, and evidence text", () => {
    mount({ payload: { ...REQUEST, branch: `fm/${"x".repeat(300)}`, evidence: "y".repeat(5000) } });
    const evidence = valueOf("Evidence");
    expect(evidence.className).toContain("max-h-64");
    expect(evidence.className).toContain("overflow-y-auto");
    expect(evidence.className).toContain("break-words");
    expect(valueOf("Branch").className).toContain("break-all");
    expect(valueOf("Task").className).toContain("break-all");
  });

  it("[U1239] names theme tokens only: no hex color and no fixed Tailwind palette color in the source", () => {
    const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "merge-approval-form.tsx"), "utf8");
    expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    const palette = "red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone|white|black";
    expect(source).not.toMatch(new RegExp(`\\b(?:bg|text|border|ring|fill|stroke|outline|divide|from|to|via)-(?:${palette})(?:-\\d+)?\\b`));
  });
});

