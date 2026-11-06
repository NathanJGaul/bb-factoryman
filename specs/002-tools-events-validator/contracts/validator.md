# Contract: the validator interface, the no-mistakes adapter, and the driver

## Interface

```ts
interface Validator {
  start(input: { cwd: string; intent: string; wait?: string }): Promise<ValidatorResult<RunView>>;
  status(input: { cwd: string; runId?: string }): Promise<ValidatorResult<RunView>>;
  findings(input: { cwd: string; runId?: string }): Promise<ValidatorResult<Finding[]>>;
  answer(input: { cwd: string; response: Answer }): Promise<ValidatorResult<RunView>>;
  cancel(input: { cwd: string; runId?: string }): Promise<ValidatorResult<void>>;
}

type ValidatorResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: { kind: "unreadable" | "command_failed" | "no_run"; message: string } };

interface RunView {
  runId: string | null;
  branch: string | null;
  phase: "running" | "gate" | "finished";
  gate: Gate | null;
  outcome: Outcome | null;
  prUrl: string | null;
  error: string | null;
}

interface Gate { step: string; status: string; findings: Finding[] }
interface Finding { id: string; severity: string; file: string; action: string; description: string }
type Outcome = "checks-passed" | "passed" | "passed-with-override" | "passed-with-skips" | "failed" | "cancelled";
type Answer =
  | { action: "approve" }
  | { action: "skip" }
  | { action: "fix"; findingIds: string[]; instructions?: string };
```

`start` returns `phase: "running"` when the wait elapsed with neither a gate nor an outcome.
Every operation returns a value and never throws for an expected failure.

## No-mistakes adapter

| Operation | Command, run in `cwd` |
| --- | --- |
| `start` | `no-mistakes axi run --intent <intent> --wait <wait>` |
| `status` | `no-mistakes axi status [--run <id>]` |
| `findings` | `status`, then the gate's findings (empty when there is no gate) |
| `answer` | `no-mistakes axi respond --action <approve\|fix\|skip> [--findings <ids>] [--instructions <text>] --wait <wait>` |
| `cancel` | `no-mistakes axi abort [--run <id>]` |

The adapter never passes `--yes` or `-y`.
It reads standard output only and decodes it with `@toon-format/toon`.

Decoding rules, from the recorded output in `test/fixtures/recorded/no-mistakes-1.84.0/`:

- The run object is `run` or, when the status names another branch's run, `other_branch_run`.
- `gate` is an object with `step`, `status`, and `findings`, or a bare step name.
  The finding columns come from the header, so a missing `line` column or an extra column is fine.
- `outcome` is a top-level key with an optional `error`.
- `pr` is the pull request URL when present.
- `error` at the top level, with no run, is `command_failed` with that message.
- Anything else, including an empty output, an undecodable output, or an outcome not in the list, is `unreadable`.

Phase rule: a gate means `gate`, an outcome means `finished`, and otherwise `running`.

## Driver

```ts
class ValidationDriver {
  ensure(taskId: string): void;
  answer(taskId: string, response: Answer, actor: Actor): Promise<AnswerResult>;
  resumeAll(): void;
  dispose(): void;
}
```

Loop for one task, repeated while the task is `validating` or `needs_decision`:

| Task state | Call | Result | Event applied |
| --- | --- | --- | --- |
| `validating` | `start` | `phase: running` | none, sleep, repeat |
| `validating` | `start` | `phase: gate` | `finding` (actor `system`), evidence names the step and the finding count |
| `validating` | `start` | `finished`, `checks-passed`, with `prUrl` | `validated` (`pipelineFinished: true`, `prUrl`) |
| `validating` | `start` | `finished`, `checks-passed`, no `prUrl` | `finding`, evidence "no pull request" |
| `validating` | `start` | `finished`, `passed-with-override`, `passed-with-skips`, or `passed` | `finding`, evidence names the outcome |
| `validating` | `start` | `finished`, `failed` or `cancelled` | `fail`, evidence is the validator's error |
| `validating` | `start` | error | count it, sleep, repeat |
| `validating` | `start` | error five times in a row | `finding`, evidence is the error |
| `needs_decision` | `status` | error | none, sleep, repeat |
| `needs_decision` | `status` | `phase: running` | `resolve` (actor `system`) |
| `needs_decision` | `status` | `gate` or `finished`, equal to the first view of this wait | none, sleep, repeat |
| `needs_decision` | `status` | `gate` or `finished`, different from the first view of this wait | `resolve` (actor `system`) |

The first view of a wait is the first successful `status` result after the task entered `needs_decision` or after a restart.
Two views are equal when their phase, gate step, gate status, finding IDs, outcome, and run ID are equal.
A run that finished with an override, skipped steps, or no pull request therefore parks the task until someone starts a new run in no-mistakes.
D-031 records that no tool answers or overrides these cases.

`answer` calls `validator.answer`, then applies `resolve` with the caller's actor.
The loop never calls `answer`.
`dispose` stops the loops and cancels nothing.

The intent for `start` is the `start` event's evidence, which is the dispatch description.
The working directory is the worker environment's path from `BbPort`.
The delays and the clock are injected.
