import { randomBytes } from "node:crypto";
import type { BbPluginApi } from "@get-bb/plugin-sdk";
import { createBbPort } from "./bb/adapter";
import { RulesTableResolver } from "./dispatch/resolver";
import type { DispatchResolver } from "./dispatch/types";
import { runCommand, type Exec } from "./exec";
import { nodeFiles, type Files } from "./files";
import { MachineMonitor, pollMsFrom } from "./machines/monitor";
import { createRemoteRunner, routeExec } from "./machines/remote-exec";
import { createMergeExecutor } from "./git/merge";
import { Runtime, type Settings } from "./runtime";
import { recover } from "./store/replay";
import { openSqliteStore } from "./store/sqlite";
import { registerTools } from "./tools/register";
import { NoMistakesValidator } from "./validator/no-mistakes";
import { ValidationDriver } from "./validator/driver";
import type { Validator } from "./validator/types";
import { EventHandlers, registerHandlers } from "./wiring/handlers";
import { drain, registerQueue } from "./limits/queue";
import { WebhookNotifier } from "./limits/webhook";
import { registerReadRpc } from "./rpc/read";
import { reconcileOnStart } from "./wiring/startup";
import { registerStamper } from "./wiring/stamp";
import { Notifier } from "./wiring/wake";
import { runFactorymanCommand } from "./tools/supervisor-command";

export interface PluginOptions {
  exec?: Exec;
  now?: () => string;
  newId?: () => string;
  sleep?: (ms: number) => Promise<void>;
  validator?: Validator;
  pollMs?: number;
  /** Replaces the project file reader. */
  files?: Files;
  /** Replaces the rules-table dispatch resolver (D-051 style injection). */
  resolver?: DispatchResolver;
  /** Give a worker the one-line tool hint of its harness. The default is off (task H14 decides later). */
  toolHints?: boolean;
  /** Polling for commands on remote machines. */
  remote?: { pollMs?: number; timeoutMs?: number };
  /** How often the machine monitor reads the machines, in milliseconds. The default comes from the `machinePollSeconds` setting. */
  machinePollMs?: number;
  /** Replaces `fetch` for the webhook. */
  fetch?: (url: string, init: { method: string; headers: Record<string, string>; body: string; signal: AbortSignal }) => Promise<{ ok: boolean; status: number }>;
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
        label: "Approval timeout (minutes)",
        description: "How long a merge or decision form waits for the owner before it counts as not answered.",
        default: 10,
      },
      maxWorkers: {
        type: "number",
        label: "Maximum running workers",
        description: "The most workers that run at once across all projects. Dispatches beyond it wait in a queue. 0 means no cap.",
        default: 0,
      },
      webhookUrl: {
        type: "string",
        label: "Webhook URL",
        description: "The plugin posts a JSON message here when a task needs attention. Leave it empty to turn it off. Treat the URL as a secret.",
        default: "",
      },
      machinePollSeconds: {
        type: "number",
        label: "Machine check interval (seconds)",
        description: "How often the plugin checks that the machines with running workers are still online.",
        default: 30,
      },
    });
    let values = await handle.get();
    const hooks: { afterSettings?: () => void } = {};
    handle.onChange((next) => {
      values = next;
      hooks.afterSettings?.();
    });
    const settings = (): Settings => ({
      mergeMethod: mergeMethod(values.mergeMethod),
      approvalTimeoutMs: Math.max(1, Math.round(values.approvalTimeoutMinutes * 60_000)),
      machinePollMs: options.machinePollMs ?? pollMsFrom(values.machinePollSeconds),
      maxWorkers: Math.max(0, Math.floor(values.maxWorkers)),
    });

    const store = openSqliteStore(bb.storage.database());
    const recovery = recover(store);
    for (const corrupt of recovery.corrupt) {
      bb.log.error(`Task ${corrupt.taskId} has a corrupt log (row ${corrupt.seq}): ${corrupt.message}`);
    }

    const port = createBbPort(bb);
    const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
    // Commands for a task on a remote machine run there, through a host terminal. The rest run on the server.
    const exec = routeExec(options.exec ?? runCommand, createRemoteRunner(port, sleep, options.remote));
    const rt = new Runtime({
      store,
      bb: port,
      exec,
      files: options.files ?? nodeFiles,
      resolver: options.resolver ?? new RulesTableResolver(),
      log: bb.log,
      now: options.now ?? (() => new Date().toISOString()),
      newId: options.newId ?? (() => `t-${randomBytes(4).toString("hex")}`),
      sleep,
      settings,
    });

    const webhook = new WebhookNotifier({ fetch: options.fetch ?? ((url, init) => fetch(url, init)), log: bb.log, url: () => values.webhookUrl });
    const notifier = new Notifier(rt, webhook);
    rt.onApplied((applied) => notifier.onApplied(applied));
    const driver = new ValidationDriver(rt, options.validator ?? new NoMistakesValidator(exec), { pollMs: options.pollMs });
    rt.onApplied(({ task }) => {
      if (task.state === "validating") driver.ensure(task.taskId);
    });
    bb.onDispose(() => driver.dispose());
    registerStamper(rt);
    registerQueue(rt);
    // A raised cap frees slots at once.
    hooks.afterSettings = () => void drain(rt);
    registerReadRpc(bb, store);
    registerHandlers(bb, new EventHandlers(rt, notifier, bb.pluginId));
    registerTools(bb, rt, createMergeExecutor(exec), driver, { toolHints: options.toolHints === true });

    // bb.sdk is bound once the factory returns, so the live-state comparison runs in a service.
    bb.background.service("factoryman-startup", {
      async start(signal) {
        await reconcileOnStart(rt, notifier);
        driver.resumeAll();
        await drain(rt);
        if (!signal.aborted) await new Promise<void>((resolve) => signal.addEventListener("abort", () => resolve(), { once: true }));
      },
    });
    const monitor = new MachineMonitor(rt);
    bb.events.on("experimental_host.deleted", async (payload) => {
      try {
        await monitor.hostDeleted(payload.host.id, payload.host.name);
      } catch (error) {
        bb.log.error(`The experimental_host.deleted handler failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    });
    bb.background.service("factoryman-machines", {
      async start(signal) {
        while (!signal.aborted) {
          try {
            await monitor.tick();
          } catch (error) {
            bb.log.error(`The machine monitor failed: ${error instanceof Error ? error.message : String(error)}`);
          }
          await new Promise<void>((resolve) => {
            const timer = setTimeout(resolve, rt.deps.settings().machinePollMs);
            signal.addEventListener("abort", () => (clearTimeout(timer), resolve()), { once: true });
          });
        }
      },
    });
    bb.cli.register({
      name: "factoryman",
      summary: "Factory Man commands",
      commands: [
        {
          name: "supervisor",
          summary: "Start a supervisor with its role from the first turn, or make an existing thread the supervisor, so bb offers it the five supervisor tools",
          usage: "bb factoryman supervisor <thread-id>\nbb factoryman supervisor start [--project <id>] [--profile <name>] [--prompt <text>]",
        },
        {
          name: "protection",
          summary: "Print the branch-protection steps for a repository. It runs nothing",
          usage: "bb factoryman protection <owner/repo> [--branch <branch>] [--check <name>]",
        },
        {
          name: "import-registry",
          summary: "Preview the move from firstmate's project registry. It only reads",
          usage: "bb factoryman import-registry --file <path>",
        },
        {
          name: "dispatch",
          summary: "Write a starter dispatch.json for a project, so dispatch has a default harness. It never overwrites a file",
          usage: "bb factoryman dispatch init --provider <id> [--project <id>] [--model <id>] [--level <id>] [--mode <mode>]",
        },
        {
          name: "preflight",
          summary: "Report what a remote machine is missing before the first dispatch",
          usage: "bb factoryman preflight <machine> --project <project-id> [--provider <provider-id>]",
        },
      ],
      run: (argv, ctx) => runFactorymanCommand(rt, argv, ctx),
    });
  };
}

export default createPlugin();
