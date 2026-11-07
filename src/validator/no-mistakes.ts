import type { Exec, ExecResult } from "../exec";
import { parseAbort, parseRun } from "./toon";
import type { Answer, Finding, RunView, Validator, ValidatorResult } from "./types";

const DEFAULT_WAIT = "4m";

/**
 * The validator over the `no-mistakes axi` command line (contracts/validator.md).
 * It reads standard output only, because progress and the update banner go to
 * standard error, and it never passes `--yes`: the plugin never answers a gate
 * on its own (FR-308).
 */
export class NoMistakesValidator implements Validator {
  private readonly bin: string;
  private readonly defaultWait: string;

  constructor(
    private readonly exec: Exec,
    options: { bin?: string; wait?: string } = {},
  ) {
    this.bin = options.bin ?? "no-mistakes";
    this.defaultWait = options.wait ?? DEFAULT_WAIT;
  }

  start(input: { cwd: string; intent: string; wait?: string }) {
    return this.run(input.cwd, ["axi", "run", "--intent", input.intent, "--wait", input.wait ?? this.defaultWait]);
  }

  status(input: { cwd: string; runId?: string }) {
    return this.run(input.cwd, ["axi", "status", ...(input.runId === undefined ? [] : ["--run", input.runId])]);
  }

  async findings(input: { cwd: string; runId?: string }): Promise<ValidatorResult<Finding[]>> {
    const view = await this.status(input);
    return view.ok ? { ok: true, value: view.value.gate?.findings ?? [] } : view;
  }

  answer(input: { cwd: string; response: Answer }) {
    const { response } = input;
    const flags =
      response.action === "fix"
        ? ["--action", "fix", "--findings", response.findingIds.join(","), ...(response.instructions === undefined ? [] : ["--instructions", response.instructions])]
        : ["--action", response.action];
    return this.run(input.cwd, ["axi", "respond", ...flags, "--wait", this.defaultWait]);
  }

  async cancel(input: { cwd: string; runId?: string }): Promise<ValidatorResult<void>> {
    const result = await this.exec(this.bin, ["axi", "abort", ...(input.runId === undefined ? [] : ["--run", input.runId])], { cwd: input.cwd });
    const failure = this.commandFailure(result);
    return failure ?? parseAbort(result.stdout);
  }

  private async run(cwd: string, args: string[]): Promise<ValidatorResult<RunView>> {
    const result = await this.exec(this.bin, args, { cwd });
    const failure = this.commandFailure(result);
    if (failure) return failure;
    return parseRun(result.stdout);
  }

  /** A command that never ran, or that exited with a usage error (code 2), is a command failure. Code 1 can carry a decodable final outcome. */
  private commandFailure(result: ExecResult): { ok: false; error: { kind: "command_failed"; message: string } } | null {
    if (result.error !== undefined || result.code === null) {
      return { ok: false, error: { kind: "command_failed", message: `${this.bin} could not run: ${result.error ?? "it was killed"}` } };
    }
    if (result.code === 2) {
      return { ok: false, error: { kind: "command_failed", message: `${this.bin} reported a usage error: ${(result.stderr.trim() || result.stdout.trim()) || "no message"}` } };
    }
    return null;
  }
}
