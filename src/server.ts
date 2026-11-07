import { randomBytes } from "node:crypto";
import type { BbPluginApi } from "@get-bb/plugin-sdk";
import { createBbPort } from "./bb/adapter";
import { runCommand, type Exec } from "./exec";
import { createMergeExecutor } from "./git/merge";
import { Runtime, type Settings } from "./runtime";
import { recover } from "./store/replay";
import { openSqliteStore } from "./store/sqlite";
import { registerTools } from "./tools/register";
import { runFactorymanCommand } from "./tools/supervisor-command";

export interface PluginOptions {
  exec?: Exec;
  now?: () => string;
  newId?: () => string;
  sleep?: (ms: number) => Promise<void>;
}

const MERGE_METHODS = ["squash", "merge", "rebase"] as const;

function mergeMethod(value: string | undefined): Settings["mergeMethod"] {
  return (MERGE_METHODS as readonly (string | undefined)[]).includes(value) ? (value as Settings["mergeMethod"]) : "squash";
}

/**
 * Build the plugin factory. The factory is the composition root: it is the one
 * place that reads the clock, makes task IDs, and opens the real database.
 * Tests inject the command runner, the clock, and the ID source.
 */
export function createPlugin(options: PluginOptions = {}): (bb: BbPluginApi) => Promise<void> {
  return async (bb) => {
    bb.log.info("bb-factoryman loaded");

    const handle = bb.settings.define({
      mergeMethod: {
        type: "select",
        label: "Merge method",
        description: "How a pull request is merged after the owner approves it.",
        options: [...MERGE_METHODS],
        default: "squash",
      },
      approvalTimeoutMinutes: {
        type: "number",
        label: "Merge approval timeout (minutes)",
        description: "How long the approval form waits for the owner before it counts as not answered.",
        default: 10,
      },
    });
    let values = await handle.get();
    handle.onChange((next) => {
      values = next;
    });
    const settings = (): Settings => ({
      mergeMethod: mergeMethod(values.mergeMethod),
      approvalTimeoutMs: Math.max(1, Math.round(values.approvalTimeoutMinutes * 60_000)),
    });

    const store = openSqliteStore(bb.storage.database());
    const recovery = recover(store);
    for (const corrupt of recovery.corrupt) {
      bb.log.error(`Task ${corrupt.taskId} has a corrupt log (row ${corrupt.seq}): ${corrupt.message}`);
    }

    const exec = options.exec ?? runCommand;
    const rt = new Runtime({
      store,
      bb: createBbPort(bb),
      exec,
      log: bb.log,
      now: options.now ?? (() => new Date().toISOString()),
      newId: options.newId ?? (() => `t-${randomBytes(4).toString("hex")}`),
      sleep: options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms))),
      settings,
    });

    registerTools(bb, rt, createMergeExecutor(exec));
    bb.cli.register({
      name: "factoryman",
      summary: "Factory Man commands",
      commands: [
        {
          name: "supervisor",
          summary: "Make a thread the supervisor, so bb offers it the four supervisor tools",
          usage: "bb factoryman supervisor <thread-id>",
        },
      ],
      run: (argv) => runFactorymanCommand(rt, argv),
    });
  };
}

export default createPlugin();
