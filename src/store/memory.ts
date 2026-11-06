import { defaultProjectConfig, type Store } from "./store";
import type { ApprovalRow, ProjectConfig, TaskEventRow, TaskRow } from "./types";

interface State {
  events: TaskEventRow[];
  approvals: ApprovalRow[];
  tasks: Map<string, TaskRow>;
  configs: Map<string, ProjectConfig>;
  nextSeq: number;
  nextApprovalId: number;
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const inner of Object.values(value)) deepFreeze(inner);
    Object.freeze(value);
  }
  return value;
}

/** A frozen deep copy, so a caller can neither change the store nor be changed by it. */
function frozenCopy<T>(value: T): T {
  return deepFreeze(structuredClone(value));
}

/** The store that tests use. It must pass the same contract suite as the SQLite store. */
export function createMemoryStore(): Store {
  let state: State = {
    events: [],
    approvals: [],
    tasks: new Map(),
    configs: new Map(),
    nextSeq: 1,
    nextApprovalId: 1,
  };

  return {
    appendEvent(input) {
      const row: TaskEventRow = { ...structuredClone(input), seq: state.nextSeq++ };
      state.events.push(frozenCopy(row));
      return frozenCopy(row);
    },

    listEvents(query = {}) {
      return state.events
        .filter((e) => (query.taskId === undefined || e.taskId === query.taskId) && (query.afterSeq === undefined || e.seq > query.afterSeq))
        .map((e) => frozenCopy(e));
    },

    getTask(taskId) {
      const row = state.tasks.get(taskId);
      return row === undefined ? null : frozenCopy(row);
    },

    listTasks(filter = {}) {
      return [...state.tasks.values()]
        .filter((t) => (filter.projectId === undefined || t.projectId === filter.projectId) && (filter.states === undefined || filter.states.includes(t.state)))
        .sort((a, b) => (a.taskId < b.taskId ? -1 : a.taskId > b.taskId ? 1 : 0))
        .map((t) => frozenCopy(t));
    },

    putTask(row) {
      state.tasks.set(row.taskId, frozenCopy(row));
    },

    clearTasks() {
      state.tasks.clear();
    },

    addApproval(input) {
      const row: ApprovalRow = { ...input, id: state.nextApprovalId++ };
      state.approvals.push(frozenCopy(row));
      return frozenCopy(row);
    },

    listApprovals(taskId) {
      return state.approvals.filter((a) => a.taskId === taskId).map((a) => frozenCopy(a));
    },

    getProjectConfig(projectId) {
      const stored = state.configs.get(projectId);
      return frozenCopy(stored ?? defaultProjectConfig(projectId));
    },

    putProjectConfig(config) {
      state.configs.set(config.projectId, frozenCopy(config));
    },

    transaction(fn) {
      const saved = structuredClone(state);
      try {
        return fn();
      } catch (error) {
        state = saved;
        throw error;
      }
    },

    close() {
      // Nothing to release.
    },
  };
}
