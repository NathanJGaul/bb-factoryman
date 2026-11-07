import type { Profile } from "../machine/types";

export interface QueuedRequest {
  v: 1;
  description: string;
  tags: string[];
  profile: Profile;
  /** The host ID the task is pinned to, or null for the project's default host. */
  machine: string | null;
  /** The host that holds the clone, gathered at dispatch time. */
  cloneHost: string | null;
  parentThreadId: string;
  branchPrefix: string | null;
  baseBranch: string | null;
}

export type DecodeResult = { ok: true; request: QueuedRequest } | { ok: false; message: string };

export function encodeRequest(request: QueuedRequest): Record<string, unknown> {
  return { ...request };
}

export function decodeRequest(_raw: unknown): DecodeResult {
  return { ok: false, message: "not implemented" };
}
