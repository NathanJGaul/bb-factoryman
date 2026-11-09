import { instructionText, skillsIn } from "../fake-model/instructions.ts";
import type { Offers, Wake, Who } from "./port.ts";

export interface ThreadEvent {
  seq: number;
  type: string;
  data: Record<string, unknown>;
}

/** The plugin's wake messages in a thread's event log. A wake is a turn request that the plugin made and that starts with `[factoryman] Task`. */
export function readWakes(events: ThreadEvent[]): Wake[] {
  const wakes: Wake[] = [];
  let running = false;
  for (const event of [...events].sort((a, b) => a.seq - b.seq)) {
    if (event.type === "turn/started") running = true;
    else if (event.type === "turn/completed") running = false;
    else if (event.type === "client/turn/requested" && event.data["originPluginId"] === "bb-factoryman") {
      const input = event.data["input"] as Array<{ text?: string }> | undefined;
      const text = input?.[0]?.text ?? "";
      if (text.startsWith("[factoryman] Task ")) wakes.push({ seq: event.seq, text, busy: running });
    }
  }
  return wakes;
}

export type LogLine = Record<string, unknown>;

const FACTORYMAN_TOOL = /^factoryman_[a-z]+$/;

/** The marker that tells a brain's log whose prompt it is looking at. */
const names = (who: Who, text: string): boolean =>
  who.kind === "worker" ? new RegExp(`You are the worker for (?:scout|ship) task ${who.taskId}\\.`).test(text) : text.includes(`[conformance:sup=${who.label}]`);

/** What the stub offered: the tools its latest session for the thread listed, and the skills named in that session's instruction text. */
export function stubOffers(log: LogLine[], who: Who): Offers {
  const prompts = log.filter((l) => l["kind"] === "prompt" && typeof l["text"] === "string" && names(who, l["text"] as string));
  const session = prompts.at(-1)?.["session"];
  if (session === undefined) return { tools: [], skills: [] };
  const ready = log.filter((l) => l["kind"] === "mcp-ready" && l["session"] === session).at(-1);
  const servers = (ready?.["servers"] as Array<{ tools: string[] }> | undefined) ?? [];
  const tools = [...new Set(servers.flatMap((server) => server.tools).filter((tool) => FACTORYMAN_TOOL.test(tool)))].sort();
  const texts = log.filter((l) => l["kind"] === "prompt" && l["session"] === session).map((l) => String(l["text"]));
  return { tools, skills: skillsIn(instructionText("", texts)) };
}

/** What the fake model's log recorded for the actor in its latest request. */
export function fakeOffers(log: LogLine[], who: Who): Offers {
  const actor = who.kind === "worker" ? `worker:${who.taskId}` : `sup:${who.label}`;
  const last = log.filter((l) => l["actor"] === actor).at(-1);
  if (last === undefined) return { tools: [], skills: [] };
  return { tools: [...((last["pluginTools"] as string[] | undefined) ?? [])].sort(), skills: [...((last["skills"] as string[] | undefined) ?? [])].sort() };
}

/** The thread ID in the first line of the output of `supervisor start`, or null when that line is not the success line. */
export function startedThreadId(text: string): string | null {
  const first = text.split("\n")[0] ?? "";
  return /^Started factoryman supervisor thread (\S+) /.exec(first)?.[1] ?? null;
}
