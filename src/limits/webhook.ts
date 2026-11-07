import type { Logger } from "../runtime";
import type { TaskEventRow, TaskRow } from "../store/types";

export type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: string; signal: AbortSignal }) => Promise<{ ok: boolean; status: number }>;

export class WebhookNotifier {
  constructor(_deps: { fetch: FetchLike; log: Logger; url: () => string }) {}

  async post(_task: TaskRow, _event: TaskEventRow): Promise<void> {
    // Not implemented.
  }
}
