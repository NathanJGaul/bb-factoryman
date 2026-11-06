import { and, assign, setup } from "xstate";
import { applyEffects } from "./effects";
import type { TaskEvent } from "./events";
import { GUARD_NAMES, GUARDS, type GuardName } from "./guards";
import { TABLES, type Lane } from "./table";
import type { TaskContext, TaskKind, TaskState } from "./types";

type GuardArgs = { context: TaskContext; event: TaskEvent };

/** Wrap each named guard so xstate sees a boolean and the facade sees the refusal. */
const guardImplementations = Object.fromEntries(
  GUARD_NAMES.map((name) => [name, ({ context, event }: GuardArgs) => GUARDS[name](context, event) === null]),
) as Record<GuardName, (args: GuardArgs) => boolean>;

/** Every state a lane names, as a source or as a target. */
function statesOf(lane: Lane): TaskState[] {
  const names = new Set<TaskState>(Object.keys(lane) as TaskState[]);
  for (const rows of Object.values(lane)) {
    for (const row of Object.values(rows ?? {})) names.add(row.target);
  }
  return [...names];
}

function buildMachine(kind: TaskKind) {
  const lane = TABLES[kind];
  const states = Object.fromEntries(
    statesOf(lane).map((state) => [
      state,
      {
        on: Object.fromEntries(
          Object.entries(lane[state] ?? {}).map(([type, row]) => [
            type,
            {
              // A move to the same state is targetless, so it keeps the state node active.
              ...(row.target === state ? {} : { target: row.target }),
              actions: "applyEffects",
              ...(row.guards.length > 0 ? { guard: and([...row.guards]) } : {}),
            },
          ]),
        ),
      },
    ]),
  );
  return setup({
    types: { context: {} as TaskContext, events: {} as TaskEvent },
    guards: guardImplementations,
    actions: {
      applyEffects: assign(({ context, event }) => applyEffects(context, event)),
    },
  }).createMachine({
    id: kind,
    initial: "queued",
    // Callers restore a real snapshot with `resolveState`, so this context is never read.
    context: {} as TaskContext,
    states: states as never,
  });
}

export const MACHINES = {
  ship: buildMachine("ship"),
  scout: buildMachine("scout"),
};
