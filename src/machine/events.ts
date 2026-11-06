import { z } from "zod";
import { refuse, type Refusal } from "./refusal";
import { ACTORS, APPROVAL_DECISIONS, APPROVAL_SCOPES, DELIVERY_MODES, EVENT_TYPES, TASK_KINDS, type EventType } from "./types";

const nonEmpty = z.string().min(1);
const count = z.number().int().min(0);

const profile = z.strictObject({
  provider: nonEmpty,
  model: nonEmpty,
  reasoningLevel: nonEmpty,
  permissionMode: nonEmpty,
});

/** Facts about the worker's checkout, gathered by the caller. */
const worktree = z.strictObject({
  uncommittedChanges: z.boolean(),
  unpushedCommits: count,
});

/** Fields every event carries. `evidence` is optional here; guards decide where it is required. */
const common = {
  actor: z.enum(ACTORS),
  evidence: z.string().optional(),
};

function event<const T extends EventType, S extends z.ZodRawShape>(type: T, shape: S) {
  return z.strictObject({ type: z.literal(type), ...common, ...shape });
}

const eventSchema = z.discriminatedUnion("type", [
  // `profile` may be null or absent so the `profileResolved` guard can name the refusal.
  event("start", { profile: profile.nullish(), threadId: nonEmpty, branch: nonEmpty, machine: nonEmpty.nullish() }),
  event("block", {}),
  event("unblock", {}),
  event("handoff", {}),
  event("ready", { prUrl: z.url().optional(), landedCommits: count.optional() }),
  event("report", {}),
  event("finding", {}),
  event("resolve", {}),
  event("validated", { prUrl: z.url(), pipelineFinished: z.boolean() }),
  event("request_approval", {}),
  event("record_approval", { scope: z.enum(APPROVAL_SCOPES), decision: z.enum(APPROVAL_DECISIONS) }),
  event("merge", { yolo: z.boolean() }),
  event("promote", {}),
  event("teardown", { worktree }),
  event("fail", {}),
]);

export type TaskEvent = z.infer<typeof eventSchema>;
export type EventOf<T extends EventType> = Extract<TaskEvent, { type: T }>;

export type ParseResult = { ok: true; event: TaskEvent } | { ok: false; refusal: Refusal };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Validate a raw event. Never throws. */
export function parseEvent(raw: unknown): ParseResult {
  if (!isRecord(raw)) {
    return { ok: false, refusal: refuse("invalid_event", "The event must be an object.") };
  }
  const type = raw.type;
  if (typeof type !== "string") {
    return { ok: false, refusal: refuse("invalid_event", "The event needs a string `type`.") };
  }
  if (!(EVENT_TYPES as readonly string[]).includes(type)) {
    return { ok: false, refusal: refuse("unknown_event", `Unknown event type \`${type}\`.`) };
  }
  const parsed = eventSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = issue && issue.path.length > 0 ? ` at \`${issue.path.join(".")}\`` : "";
    return { ok: false, refusal: refuse("invalid_event", `Invalid \`${type}\` event${where}: ${issue?.message ?? "unreadable"}.`) };
  }
  return { ok: true, event: parsed.data };
}

/** An ID that is not empty or whitespace. */
const id = z.string().refine((value) => value.trim() !== "", "must not be blank");

const createSchema = z.strictObject({
  type: z.literal("create"),
  actor: z.enum(ACTORS),
  taskId: id,
  projectId: id,
  kind: z.enum(TASK_KINDS),
  mode: z.enum(DELIVERY_MODES),
});

export type CreateEvent = z.infer<typeof createSchema>;

export type ParseCreateResult = { ok: true; event: CreateEvent } | { ok: false; refusal: Refusal };

/** Validate the event that creates a task. Never throws. */
export function parseCreate(raw: unknown): ParseCreateResult {
  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = issue && issue.path.length > 0 ? ` at \`${issue.path.join(".")}\`` : "";
    return { ok: false, refusal: refuse("invalid_event", `Invalid \`create\` event${where}: ${issue?.message ?? "unreadable"}.`) };
  }
  return { ok: true, event: parsed.data };
}
