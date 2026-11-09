# Quickstart: validate the supervisor start command, the advice, and the roles block

This guide proves the feature end to end.
It runs the tests first and the live conformance runs last.

## Prerequisites

- `pnpm install --frozen-lockfile` has run.
- `bwrap` is installed, and the four harness command-line tools are on the `PATH`: `claude`, `codex`, `pi`, `omp`.
- A lab directory outside `/tmp` and outside any path that contains `firstmate`.
  This feature uses `/var/tmp/bblab-supervisor-start`.
- No credential is needed or used.

## 1. Unit and acceptance tests

```sh
pnpm vitest run src/tools/supervisor-start.test.ts src/tools/supervisor-command.test.ts
pnpm vitest run src/dispatch/config.test.ts src/validator/agent.test.ts src/harness/advice.test.ts
pnpm vitest run test/acceptance/supervisor-start.test.ts test/acceptance/validator-observe.test.ts
pnpm run check
```

Expected: every file passes, and `pnpm run check` (type check, lint, full suite) passes with no new warning.

## 2. The command against the fake bb

The acceptance test starts the plugin factory in the fake host and runs the command the way bb does.
It checks:

- `supervisor start --project p --profile claude` makes one `spawnSupervisor` call with `{ role: "supervisor" }`, and prints the thread ID.
- With neither a flag nor a `roles.supervisor.profile`, the command exits 1, names both ways, and makes no spawn call.
- A stamp on a Codex thread prints `bb thread clear`, and a stamp on a Claude Code thread does not.

## 3. The validator line

The acceptance test hands off a `no-mistakes` ship task with a scripted configuration file and scripted provider states.
It reads the evidence of the `handoff` event and checks the line for each case in [contracts/validator-observation.md](contracts/validator-observation.md).
It also lists every `exec` call and expects the single read command.

## 4. Live conformance runs

```sh
pnpm run conformance -- --tier 1 --lab-dir /var/tmp/bblab-supervisor-start
pnpm run conformance -- --tier 1.5 --harness claude-code --lab-dir /var/tmp/bblab-supervisor-start
pnpm run conformance -- --tier 1.5 --harness codex --lab-dir /var/tmp/bblab-supervisor-start
pnpm run conformance -- --tier 1.5 --harness pi --lab-dir /var/tmp/bblab-supervisor-start
pnpm run conformance -- --tier 1.5 --harness omp --lab-dir /var/tmp/bblab-supervisor-start
pnpm run conformance:docs
```

Expected for each run:

- The exit code is 0.
- S9 is `pass`, with the checks `S9.start-command`, `S9.start-tools`, `S9.unstamped-no-tools`, `S9.stamp-advice`, and `S9.tools-after-step`.
- No scenario fails, and no known gap is listed.
- The isolation check is clean and the tripwire recorded no event.

Run the five commands one after the other, because they share the lab directory.

## 5. Records

- `docs/DECISIONS.md` ends with D-123 onward.
- `.specify/memory/constitution.md` is at 1.4.0 and its Principle VI names H4 and H12.
- `docs/HARNESS-SUPPORT.md` lists no known gap.
- The pull request description carries the five verdicts.
