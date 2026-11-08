import { screen } from "@testing-library/react";
import { vi, type Mock } from "vitest";
import type { PluginPendingInteractionProps } from "@get-bb/plugin-sdk/app";
import type { MergeRequestPayload } from "../../src/approval/contract";

/** A merge request as factoryman_merge builds it for a direct-PR ship task. */
export const REQUEST: MergeRequestPayload = {
  taskId: "t-abc12345",
  branch: "fm/t-abc12345",
  prUrl: "https://github.com/acme/widgets/pull/7",
  evidence: "Added the --json flag.\nTests pass.",
};

type Answer = PluginPendingInteractionProps["submit"];
type Cancel = PluginPendingInteractionProps["cancel"];

export interface FormHarness {
  props: PluginPendingInteractionProps;
  submit: Mock<Answer>;
  cancel: Mock<Cancel>;
}

/** A fixed instant for the interaction's `createdAt`. The form does not show it. */
export const CREATED_AT = 1_700_000_000_000;

/** The controls of a readable form, by name. */
export const ALL_CONTROLS = ["Approve", "Deny", "Cancel", "Comment (optional)"];

/** The names of the controls that are disabled now, so a failure says which control is wrong. */
export function disabledControls(): string[] {
  const controls: Array<[string, HTMLElement]> = [
    ...screen.getAllByRole("button").map((button): [string, HTMLElement] => [button.textContent ?? "", button]),
    ["Comment (optional)", screen.getByRole("textbox")],
  ];
  return controls.filter(([, control]) => control.hasAttribute("disabled")).map(([name]) => name);
}

export interface FormOptions {
  id?: string;
  threadId?: string;
  title?: string;
  payload?: unknown;
  expiresAt?: number | null;
  submit?: Answer;
  cancel?: Cancel;
}

/** Props for the renderer, with spies on `submit` and `cancel`. Both resolve at once unless the options say otherwise. */
export function formHarness(options: FormOptions = {}): FormHarness {
  const submit = vi.fn<Answer>(options.submit ?? (async () => undefined));
  const cancel = vi.fn<Cancel>(options.cancel ?? (async () => undefined));
  const props: PluginPendingInteractionProps = {
    interaction: {
      id: options.id ?? "pint_test",
      threadId: options.threadId ?? "thr-sup",
      title: options.title ?? `Approve merge of task ${REQUEST.taskId}`,
      payload: (options.payload === undefined ? { ...REQUEST } : options.payload) as never,
      createdAt: CREATED_AT,
      expiresAt: options.expiresAt === undefined ? null : options.expiresAt,
    },
    submit,
    cancel,
  };
  return { props, submit, cancel };
}

/** A promise that the test settles by hand, to hold an answer in flight. */
export function deferred<T = void>(): { promise: Promise<T>; resolve: (value: T) => void; reject: (error: unknown) => void } {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
