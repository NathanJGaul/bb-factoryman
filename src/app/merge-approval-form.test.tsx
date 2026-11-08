  it.each(["text-red-500", "border-t-red-500", "shadow-red-500", "bg-white", "text-[rgb(1,2,3)]", 'style={{ color: "red" }}', "#fff"])(
    "[U1239] the color check flags %s",
    (sample) => {
      expect(NOT_THEME_TOKENS.some((pattern) => pattern.test(sample))).toBe(true);
    },
  );

  it.each(["bg-foreground", "text-muted-foreground", "border-border", "hover:bg-state-hover", "whitespace-pre-wrap", "focus-visible:ring-ring"])(
    "[U1239] the color check accepts the theme token or utility %s",
    (sample) => {
      expect(NOT_THEME_TOKENS.some((pattern) => pattern.test(sample))).toBe(false);
    },
  );

  it("[U1239] names theme tokens only: the component source has no hex color, fixed palette color, arbitrary color, or inline style", () => {
    const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "merge-approval-form.tsx"), "utf8");
    expect(NOT_THEME_TOKENS.filter((pattern) => pattern.test(source)).map(String)).toEqual([]);
  });
// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { act, cleanup, fireEvent, screen, within } from "@testing-library/react";
import { renderSlot } from "@get-bb/plugin-sdk/testing/app";
import { afterEach, describe, expect, it } from "vitest";
import { ALL_CONTROLS, REQUEST, deferred, disabledControls, formHarness, type FormOptions } from "../../test/fixtures/approval-form";
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

const PALETTE = "red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone";
/** Anything that sets a color outside the host theme's tokens. */
const NOT_THEME_TOKENS: RegExp[] = [
  /#[0-9a-fA-F]{3,8}\b/, // a hex color
  new RegExp(`-(?:${PALETTE})-\\d{2,3}\\b`), // a fixed palette color in any utility: text-red-500, border-t-red-500, shadow-red-500
  /-(?:white|black)\b/, // bg-white, text-black
  /\[(?:rgb|rgba|hsl|hsla|oklch|oklab|color-mix|#)/, // an arbitrary color value
  /\bstyle=\{/, // an inline style
];

const EXPIRES_AT = Date.UTC(2026, 10, 8, 15, 30);
const EXPIRES_AT_ISO = "2026-11-08T15:30:00.000Z";

const button = (name: string) => screen.getByRole("button", { name });
const comment = () => screen.getByRole("textbox");
const type = (value: string) => fireEvent.change(comment(), { target: { value } });
/** Press a button and let the answer settle. */
async function press(name: string) {
  await act(async () => {
    fireEvent.click(button(name));
  });
}

describe("MergeApprovalForm: the request", () => {
  it("[U1220] shows the task id and the branch under their labels, with the font-mono class", () => {
    mount();
    expect(valueOf("Task").textContent).toBe(REQUEST.taskId);
    expect(valueOf("Task").className).toContain("font-mono");
    expect(valueOf("Branch").textContent).toBe(REQUEST.branch);
    expect(valueOf("Branch").className).toContain("font-mono");
  });

  it.each(["https://github.com/acme/widgets/pull/7", "http://forge.example/acme/widgets/pull/7"])("[U1221] shows %s as a link to that URL", (url) => {
    mount({ payload: { ...REQUEST, prUrl: url } });
    const link = within(valueOf("Pull request")).getByRole("link", { name: url });
    expect(link.getAttribute("href")).toBe(url);
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
    await press("Approve");
    expect(submit).toHaveBeenCalledTimes(1);
    expect(submit.mock.calls[0]?.[0]).toStrictEqual({ decision: "approved" });
  });

  it("[U1226] submits the trimmed comment with Approve", async () => {
    const { submit } = mount();
    type("  Looks good.  ");
    await press("Approve");
    expect(submit.mock.calls[0]?.[0]).toStrictEqual({ decision: "approved", comment: "Looks good." });
  });

  it("[U1226] leaves out a blank comment when Approve is pressed", async () => {
    const { submit } = mount();
    type("   ");
    await press("Approve");
    expect(submit.mock.calls[0]?.[0]).toStrictEqual({ decision: "approved" });
  });
});

describe("MergeApprovalForm: an answer in flight", () => {
  const group = () => screen.getByRole("group", { name: "Merge approval request" });

  it("[U1229] enables the controls before a press, disables them while submit is pending, and keeps them disabled once it resolves", async () => {
    const held = deferred();
    mount({ submit: () => held.promise });
    expect(disabledControls()).toEqual([]);
    expect(group().getAttribute("aria-busy")).not.toBe("true");

    await press("Approve");
    expect(disabledControls()).toEqual(ALL_CONTROLS);
    expect(group().getAttribute("aria-busy")).toBe("true");

    await act(async () => {
      held.resolve();
    });
    expect(disabledControls()).toEqual(ALL_CONTROLS);
  });

  it("[U1230] sends no second answer for a second press while the first is pending", async () => {
    const held = deferred();
    const { submit } = mount({ submit: () => held.promise });
    await press("Approve");
    await press("Approve");
    expect(submit).toHaveBeenCalledTimes(1);
  });
});

describe("MergeApprovalForm: Deny and Cancel", () => {
  it("[U1227] submits { decision: denied } once when Deny is pressed", async () => {
    const { submit } = mount();
    await press("Deny");
    expect(submit).toHaveBeenCalledTimes(1);
    expect(submit.mock.calls[0]?.[0]).toStrictEqual({ decision: "denied" });
  });

  it("[U1227] submits the trimmed comment with Deny", async () => {
    const { submit } = mount();
    type("  Not yet.  ");
    await press("Deny");
    expect(submit).toHaveBeenCalledTimes(1);
    expect(submit.mock.calls[0]?.[0]).toStrictEqual({ decision: "denied", comment: "Not yet." });
  });

  it("[U1228] calls cancel once when Cancel is pressed, and never calls submit", async () => {
    const { submit, cancel } = mount();
    await press("Cancel");
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(submit).not.toHaveBeenCalled();
  });

  it("[U1237] labels the comment field and names the Approve, Deny, and Cancel buttons", () => {
    mount();
    expect(screen.getByLabelText("Comment (optional)")).toBe(comment());
    expect(screen.getAllByRole("button").map((control) => control.textContent)).toEqual(["Approve", "Deny", "Cancel"]);
  });
});

describe("MergeApprovalForm: the pull request link", () => {
  it("[U1240] underlines the pull request link so that it reads as a link", () => {
    mount();
    const link = within(valueOf("Pull request")).getByRole("link");
    // The exact token: the class "underline-offset-2" also contains the text "underline".
    expect(link.classList.contains("underline")).toBe(true);
  });

  it("[U1242] opens the pull request through bb's navigation, so that bb's open-in-app preference applies", () => {
    const { slot } = mount();
    fireEvent.click(within(valueOf("Pull request")).getByRole("link"));
    expect(slot.inspection.navigateCalls).toEqual([{ method: "openUrl", url: REQUEST.prUrl }]);
  });

  it.each(["javascript:alert(1)", "ftp://forge.example/pull/7", "data:text/html,<b>x</b>", "not a url", "//forge.example/pull/7"])(
    "[U1222] shows %s as plain text with no link",
    (value) => {
      mount({ payload: { ...REQUEST, prUrl: value } });
      const cell = valueOf("Pull request");
      expect(cell.textContent).toBe(value);
      expect(within(cell).queryByRole("link")).toBeNull();
    },
  );
});

describe("MergeApprovalForm: a failed answer", () => {
  it("[U1231] shows the rejection in an alert, re-enables the controls, and keeps the typed comment", async () => {
    const { submit } = mount({ submit: async () => { throw new Error("bb said no"); } });
    type("My reason.");
    await press("Approve");
    expect(screen.getByRole("alert").textContent).toContain("bb said no");
    expect(disabledControls()).toEqual([]);
    expect((comment() as HTMLTextAreaElement).value).toBe("My reason.");
    expect(screen.getByRole("group", { name: "Merge approval request" }).getAttribute("aria-busy")).not.toBe("true");
    await press("Deny");
    expect(submit).toHaveBeenCalledTimes(2);
    expect(submit.mock.calls[1]?.[0]).toStrictEqual({ decision: "denied", comment: "My reason." });
  });

  it("[U1232] shows a rejected cancel in an alert and re-enables the controls", async () => {
    mount({ cancel: async () => { throw new Error("cancel refused"); } });
    await press("Cancel");
    expect(screen.getByRole("alert").textContent).toContain("cancel refused");
    expect(disabledControls()).toEqual([]);
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
    await press("Approve");
    expect(screen.getByRole("alert").textContent).toContain("bb said no");
    await press("Approve");
    expect(attempts).toBe(2);
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("MergeApprovalForm: a request it cannot read", () => {
  it.each([
    ["null", null],
    ["a missing field", { taskId: REQUEST.taskId, branch: REQUEST.branch, prUrl: REQUEST.prUrl }],
    ["a field of the wrong type", { ...REQUEST, taskId: 7 }],
    ["an extra field", { ...REQUEST, extra: "x" }],
    ["a string", "approve everything"],
  ])("[U1233] shows the unreadable notice, no Approve, and both Deny and Cancel for %s", (_name, payload) => {
    mount({ payload });
    expect(screen.getByRole("alert").textContent).toMatch(/unreadable/i);
    expect(screen.queryByRole("button", { name: "Approve" })).toBeNull();
    expect(button("Deny").hasAttribute("disabled")).toBe(false);
    expect(button("Cancel").hasAttribute("disabled")).toBe(false);
  });

  it("[U1234] submits a denial from the unreadable notice", async () => {
    const { submit } = mount({ payload: null });
    await press("Deny");
    expect(submit.mock.calls.map((call) => call[0])).toStrictEqual([{ decision: "denied" }]);
  });

  it("[U1234] cancels from the unreadable notice without submitting", async () => {
    const { submit, cancel } = mount({ payload: null });
    await press("Cancel");
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(submit).not.toHaveBeenCalled();
  });
});

describe("MergeApprovalForm: expiry, keys, and style", () => {
  it("[U1235] shows the expiry in a time element when expiresAt is set", () => {
    const { container } = mount({ expiresAt: EXPIRES_AT }).slot;
    const time = container.querySelector("time");
    expect(time?.getAttribute("datetime")).toBe(EXPIRES_AT_ISO);
    expect(time?.parentElement?.textContent).toMatch(/^Expires /);
    // The visible date is locale text, so check only that it names the year.
    expect(time?.textContent).toContain("2026");
  });

  it("[U1235] shows no expiry line when expiresAt is null", () => {
    const { container } = mount({ expiresAt: null }).slot;
    expect(container.querySelector("time")).toBeNull();
    expect(container.textContent).not.toMatch(/Expires/);
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

  it("[U1238] carries the height-limit, scroll, and break classes on the evidence, the branch, and the task id (class tokens only: the real fit is the live check)", () => {
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

