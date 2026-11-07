import type { Finding, RunView, Validator, ValidatorResult } from "./types";

type Operation = "start" | "status" | "findings" | "answer" | "cancel";

/**
 * A validator for tests. `script` queues the results of one operation. Each
 * call takes the next result and repeats the last one when the queue runs
 * out. An operation with no script returns a `no_run` error.
 */
export class FakeValidator implements Validator {
  calls: Array<{ operation: Operation; input: unknown }> = [];
  private readonly scripts = new Map<Operation, ValidatorResult<unknown>[]>();

  script(operation: Operation, results: ValidatorResult<unknown>[]): void {
    this.scripts.set(operation, [...results]);
  }

  start(input: { cwd: string; intent: string; wait?: string }) {
    return this.next<RunView>("start", input);
  }

  status(input: { cwd: string; runId?: string }) {
    return this.next<RunView>("status", input);
  }

  findings(input: { cwd: string; runId?: string }) {
    return this.next<Finding[]>("findings", input);
  }

  answer(input: { cwd: string; response: import("./types").Answer }) {
    return this.next<RunView>("answer", input);
  }

  cancel(input: { cwd: string; runId?: string }) {
    return this.next<void>("cancel", input);
  }

  private async next<T>(operation: Operation, input: unknown): Promise<ValidatorResult<T>> {
    this.calls.push({ operation, input });
    const queue = this.scripts.get(operation);
    if (queue === undefined || queue.length === 0) {
      return { ok: false, error: { kind: "no_run", message: `The fake has no scripted result for ${operation}.` } };
    }
    const result = queue.length > 1 ? queue.shift()! : queue[0]!;
    return result as ValidatorResult<T>;
  }
}
