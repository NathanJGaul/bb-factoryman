import type { Logger } from "../runtime";
import type { TaskEventRow, TaskRow } from "../store/types";
import { clip } from "../tools/results";

export type FetchLike = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string; signal: AbortSignal },
) => Promise<{ ok: boolean; status: number }>;

const TIMEOUT_MS = 5000;
const EVIDENCE_LIMIT = 600;

/**
 * Posts a JSON body to the owner's webhook when a task enters an attention
 * state (D-087). The URL is a secret, so it never reaches a log line: a failure
 * names the host only. A failure never undoes a transition.
 */
export class WebhookNotifier {
  private readonly fetch: FetchLike;
  private readonly log: Logger;
  private readonly url: () => string;
  private readonly timeoutMs: number;

  constructor(deps: { fetch: FetchLike; log: Logger; url: () => string; timeoutMs?: number }) {
    this.timeoutMs = deps.timeoutMs ?? TIMEOUT_MS;
    this.fetch = deps.fetch;
    this.log = deps.log;
    this.url = deps.url;
  }

  async post(task: TaskRow, event: TaskEventRow): Promise<void> {
    const target = this.url().trim();
    if (target === "") return;
    let parsed: URL;
    try {
      parsed = new URL(target);
    } catch {
      return;
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return;
    const body = {
      event: "task.attention",
      at: event.at,
      task: {
        taskId: task.taskId,
        projectId: task.projectId,
        kind: task.kind,
        mode: task.mode,
        state: task.state,
        workerThreadId: task.workerThreadId,
        branch: task.branch,
        machine: task.machine,
        pullRequestUrl: task.pullRequestUrl,
      },
      evidence: event.evidence === null ? null : clip(event.evidence, EVIDENCE_LIMIT),
    };
    try {
      const answer = await this.fetch(target, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(this.timeoutMs) });
      if (!answer.ok) this.log.warn(`The webhook at ${parsed.host} answered HTTP ${answer.status} for task ${task.taskId}.`);
    } catch (error) {
      this.log.warn(`The webhook at ${parsed.host} could not be reached for task ${task.taskId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
