import type { Actor } from "../../src/machine/types";
import type { Decider } from "../../src/tools/decide";
import type { AnswerResult } from "../../src/validator/driver";
import type { Answer, RunView } from "../../src/validator/types";

export type LiveView = { ok: true; view: RunView } | { ok: false; message: string };

/**
 * A `Decider` for tool tests. `views` queues what `current` returns (the last one repeats), and `answerResult` and `rerunResult`
 * are what the two send paths return. Every call is recorded in order.
 */
export class FakeDecider implements Decider {
  calls: Array<{ method: "current" | "answer" | "rerun"; args: unknown[] }> = [];
  views: LiveView[] = [{ ok: false, message: "the fake has no view" }];
  answerResult: AnswerResult = { ok: true };
  rerunResult: AnswerResult = { ok: true };
  /** Runs inside `current` before it returns, so a test can change the world between two reads. */
  onCurrent: ((count: number) => void | Promise<void>) | null = null;
  private reads = 0;

  async current(taskId: string): Promise<LiveView> {
    this.calls.push({ method: "current", args: [taskId] });
    this.reads += 1;
    await this.onCurrent?.(this.reads);
    return this.views.length > 1 ? this.views.shift()! : this.views[0]!;
  }

  async answer(taskId: string, response: Answer, actor: Actor, evidence?: string): Promise<AnswerResult> {
    this.calls.push({ method: "answer", args: [taskId, response, actor, evidence] });
    return this.answerResult;
  }

  async rerun(taskId: string, actor: Actor, evidence: string): Promise<AnswerResult> {
    this.calls.push({ method: "rerun", args: [taskId, actor, evidence] });
    return this.rerunResult;
  }

  count(method: "current" | "answer" | "rerun"): number {
    return this.calls.filter((call) => call.method === method).length;
  }
}
