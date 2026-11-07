import { readFileSync } from "node:fs";

const root = new URL("./recorded/", import.meta.url);

export interface RecordedThreadEvents {
  bbVersion: string;
  sdk: string;
  events: {
    "thread.idle": { thread: { id: string }; lastAssistantText: string | null };
    "thread.failed": { thread: { id: string }; error: string | null };
    "turn.failed": { threadId: string; errorInfo: { category: string; httpStatusCode: number | null } | null };
    "interaction.pending": { thread: { id: string }; interaction: { origin: { kind: string; pluginId?: string }; payload: { title: string } } };
  };
}

/** The real bb 0.48.1 event payloads recorded in the spike. */
export function recordedBb(): RecordedThreadEvents {
  return JSON.parse(readFileSync(new URL("bb-0.48.1/thread-events.json", root), "utf8")) as RecordedThreadEvents;
}

/** One recorded no-mistakes output file, as `axi` printed it on stdout. */
export function recordedNoMistakes(name: string): string {
  return readFileSync(new URL(`no-mistakes-1.84.0/${name}`, root), "utf8");
}
