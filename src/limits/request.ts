import { z } from "zod";
import type { Profile } from "../machine/types";

/**
 * Everything that a queued task needs to start later. It sits in the `create`
 * row of the log (D-085), so a restart keeps it and replay never reads it.
 */
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

const nonBlank = z.string().refine((value) => value.trim() !== "", "must not be blank");

const schema = z.strictObject({
  v: z.literal(1),
  description: nonBlank,
  tags: z.array(z.string()),
  profile: z.strictObject({
    provider: nonBlank,
    model: nonBlank,
    reasoningLevel: nonBlank,
    permissionMode: z.enum(["accept-edits", "auto", "full"]),
  }),
  machine: nonBlank.nullable(),
  cloneHost: nonBlank.nullable(),
  parentThreadId: nonBlank,
  branchPrefix: z.string().nullable(),
  baseBranch: z.string().nullable(),
});

/** The request as plain JSON data, for the `create` event. */
export function encodeRequest(request: QueuedRequest): Record<string, unknown> {
  return { ...request };
}

/** Read a stored request. Never throws. */
export function decodeRequest(raw: unknown): DecodeResult {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return { ok: false, message: "the request is not an object" };
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue && issue.path.length > 0 ? ` at \`${issue.path.join(".")}\`` : "";
    return { ok: false, message: `${issue?.message ?? "unreadable"}${path}` };
  }
  return { ok: true, request: parsed.data };
}
