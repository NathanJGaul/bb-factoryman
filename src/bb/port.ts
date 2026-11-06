import type { Profile } from "../machine/types";

/** Plain JSON data, as bb accepts it in plugin metadata and form payloads. */
export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

export interface SpawnWorkerRequest {
  projectId: string;
  parentThreadId: string;
  prompt: string;
  profile: Profile;
  /** Plugin metadata stamped on the new thread. */
  metadata: Record<string, Json>;
  /** The branch the worktree starts from, or null for the project default. */
  baseBranch: string | null;
}

export interface ThreadInfo {
  id: string;
  projectId: string;
  /** bb's thread status, for example `active`, `idle`, or `error`. */
  status: string;
  parentThreadId: string | null;
  environmentId: string | null;
}

export interface InputRequest {
  threadId: string;
  rendererId: string;
  title: string;
  payload: Record<string, Json>;
  timeoutMs: number;
  signal?: AbortSignal;
}

/** The result of an input form, as `spike/RESULTS.md` item 20 records it. */
export type InputResult =
  | { outcome: "submitted"; value: unknown }
  | { outcome: "cancelled"; reason: string };

/** Every call the plugin makes to bb. Only `adapter.ts` implements it against the real SDK. */
export interface BbPort {
  spawnWorker(request: SpawnWorkerRequest): Promise<{ threadId: string }>;
  /** Returns null when bb does not know the thread. */
  getThread(threadId: string): Promise<ThreadInfo | null>;
  sendMessage(threadId: string, text: string): Promise<void>;
  getEnvironmentPath(environmentId: string): Promise<string | null>;
  /** Archive the worker thread, then delete its environment. */
  retireWorker(threadId: string, environmentId: string): Promise<void>;
  getProjectCheckout(projectId: string): Promise<string | null>;
  requestInput(request: InputRequest): Promise<InputResult>;
  setThreadMetadata(threadId: string, metadata: Record<string, Json>): Promise<void>;
}
