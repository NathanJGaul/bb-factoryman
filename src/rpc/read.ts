import type { BbPluginApi } from "@get-bb/plugin-sdk";
import { z } from "zod";
import { TASK_KINDS, DELIVERY_MODES, TASK_STATES } from "../machine/types";
import type { Store } from "../store/store";
import type { TaskEventRow, TaskRow } from "../store/types";

/** The version of the read contract. A change that breaks a sibling plugin bumps it (D-082). */
export const RPC_VERSION = 1;

const nullableText = z.string().nullable();

const taskSchema = z.strictObject({
  taskId: z.string(),
  projectId: z.string(),
  kind: z.enum(TASK_KINDS),
  mode: z.enum(DELIVERY_MODES),
  state: z.enum(TASK_STATES),
  workerThreadId: nullableText,
  branch: nullableText,
  machine: nullableText,
  pullRequestUrl: nullableText,
});

const eventSchema = z.strictObject({
  seq: z.number().int(),
  taskId: z.string(),
  at: z.string(),
  fromState: nullableText,
  toState: nullableText,
  event: z.string(),
  actor: z.string(),
  evidence: nullableText,
  outcome: z.enum(["applied", "refused"]),
  reasonCode: nullableText,
  reasonMessage: nullableText,
});

const version = z.literal(RPC_VERSION);
const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 1000;

const contract = {
  apiVersion: {
    experimental_description: "The version of this read contract.",
    input: z.strictObject({}),
    output: z.strictObject({ apiVersion: version }),
  },
  listTasks: {
    experimental_description: "List task rows, optionally for one project or for some states.",
    input: z.strictObject({ projectId: z.string().optional(), states: z.array(z.enum(TASK_STATES)).optional() }),
    output: z.strictObject({ apiVersion: version, tasks: z.array(taskSchema) }),
  },
  getTask: {
    experimental_description: "Read one task row, or null when the task is unknown.",
    input: z.strictObject({ taskId: z.string() }),
    output: z.strictObject({ apiVersion: version, task: taskSchema.nullable() }),
  },
  listEvents: {
    experimental_description: "List log rows in order, for one task or all, after a sequence number, up to a limit.",
    input: z.strictObject({
      taskId: z.string().optional(),
      since: z.number().int().min(0).optional(),
      limit: z.number().int().min(1).max(MAX_LIMIT).optional(),
    }),
    output: z.strictObject({ apiVersion: version, events: z.array(eventSchema) }),
  },
} as const;

const taskOf = (row: TaskRow) => ({
  taskId: row.taskId,
  projectId: row.projectId,
  kind: row.kind,
  mode: row.mode,
  state: row.state,
  workerThreadId: row.workerThreadId,
  branch: row.branch,
  machine: row.machine,
  pullRequestUrl: row.pullRequestUrl,
});

const eventOf = (row: TaskEventRow) => ({
  seq: row.seq,
  taskId: row.taskId,
  at: row.at,
  fromState: row.fromState,
  toState: row.toState,
  event: row.event,
  actor: row.actor,
  evidence: row.evidence,
  outcome: row.outcome,
  reasonCode: row.reasonCode,
  reasonMessage: row.reasonMessage,
});

/**
 * Publish the read contract for sibling plugins. It registers four read
 * methods and nothing that writes. bb lets any plugin call any registered
 * method, so the surface itself is the guarantee (spike item 10, D-082).
 */
export function registerReadRpc(bb: Pick<BbPluginApi, "rpc">, store: Store): void {
  const handlers = {
    apiVersion: async () => ({ apiVersion: RPC_VERSION }),
    listTasks: async (input: { projectId?: string; states?: Array<(typeof TASK_STATES)[number]> }) => ({
      apiVersion: RPC_VERSION,
      tasks: store.listTasks({ ...(input.projectId === undefined ? {} : { projectId: input.projectId }), ...(input.states === undefined ? {} : { states: input.states }) }).map(taskOf),
    }),
    getTask: async (input: { taskId: string }) => {
      const row = store.getTask(input.taskId);
      return { apiVersion: RPC_VERSION, task: row === null ? null : taskOf(row) };
    },
    listEvents: async (input: { taskId?: string; since?: number; limit?: number }) => ({
      apiVersion: RPC_VERSION,
      events: store
        .listEvents({ ...(input.taskId === undefined ? {} : { taskId: input.taskId }), ...(input.since === undefined ? {} : { afterSeq: input.since }) })
        .slice(0, input.limit ?? DEFAULT_LIMIT)
        .map(eventOf),
    }),
  };
  bb.rpc.register(contract, handlers as never, {
    experimental_discoverable: true,
    experimental_description: "Read-only access to Factory Man tasks and their event log. It changes nothing.",
  });
}
