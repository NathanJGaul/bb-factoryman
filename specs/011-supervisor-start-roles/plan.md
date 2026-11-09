# Implementation plan: Supervisor start command, role advice, and the dispatch roles block

**Branch**: `fm/bb-factoryman-supervisor-profile-validator-observe` | **Date**: 2026-11-09 | **Spec**: [spec.md](spec.md)

## Summary

Decision D4 option B adds two things to the harness-independence work, and this plan builds both.

1. **Supervisor start and role advice (report task H4).**
   A new command, `bb factoryman supervisor start`, spawns the supervisor with `role: supervisor` in the spawn call, so the role exists at the thread's first session.
   The existing `bb factoryman supervisor <thread>` keeps stamping, then reads the thread's provider and prints the advice that the harness contract (`roleChange`) calls for.
   The wrong "from its next session" text goes.
2. **Roles block and validator observation (report task H12).**
   The `dispatch.json` schema gains an optional `roles` block (`supervisor.profile`, `validator.agent: "observe"`).
   The plugin reads no-mistakes' `agent` setting on the host that runs the pipeline, maps it to bb providers, checks bb's provider state, and names the agent and its readiness in the preflight report and in the evidence that moves a task into `validating`.
   It writes nothing.

Then scenario S9 is made strict, the three S9 known gaps go, and tier 1 plus tier 1.5 for the four harnesses run offline to prove it.

## Technical context

- Language and tooling: TypeScript 6 (binary `tsc6`), ESM, Node 26, `pnpm` 12, `vitest` 5, `zod` 4.
  The conformance tools run under Node's type stripping, with `.ts` extensions in relative imports and `import type` for types.
- Files that change or appear in `src/`:
  - `src/bb/port.ts`, `src/bb/adapter.ts`: `spawnSupervisor`, and `providerId` on `ThreadInfo`.
  - `src/dispatch/types.ts`, `src/dispatch/config.ts`: the `roles` block.
  - `src/dispatch/gate.ts`: the readiness part of the gate becomes callable without the admission rule.
  - `src/harness/advice.ts` (new, no bb imports): the stamp advice, chosen from a contract row.
  - `src/validator/agent.ts` (new, no bb imports at runtime beyond port types): parse, map, observe, describe.
  - `src/tools/supervisor-start.ts` (new): the `start` subcommand.
  - `src/tools/supervisor-command.ts`: route `start`, new stamp output, usage text.
  - `src/tools/report.ts`: the validator line in hand-off evidence.
  - `src/machines/preflight.ts`: the `validator_agent` check, the report note.
  - `src/server.ts`: the CLI usage text.
- Files that change outside `src/`:
  - `tools/conformance/port.ts`, `real-lab.ts`, `scenarios/s09-role-change.ts`, and `test/fixtures/conformance-lab.ts` (the fake lab).
  - `conformance/known-gaps.json`, `conformance/results/*.json`, `docs/HARNESS-SUPPORT.md`, `docs/CONFORMANCE.md`.
  - `docs/DECISIONS.md` (D-123 onward), `.specify/memory/constitution.md` (1.4.0), and the sentences of `docs/LIVE-CHECK.md` and `docs/CUTOVER.md` that this change makes wrong.
  - Test fixtures: `test/fixtures/bb-port.ts`, `test/fixtures/plugin-host.ts`.
- Tests: `vitest` unit tests next to the sources, acceptance tests in `test/acceptance/`, scenario tests under `tools/conformance/scenarios/`.
  The acceptance layer is in-process, so the live tier 1.5 runs are the end-to-end proof of S9.
- bb facts used (report sections 3 to 6, `src/harness/contracts.ts`):
  - `bb.sdk.threads.spawn` takes `pluginMetadata`, and the worker spawn already seeds `role: worker` this way.
  - `bb.sdk.threads.get` returns the thread's `providerId`.
  - `contractFor(provider).roleChange` is `next-turn` for `claude-code` and `pi`, and `clear` for `codex`, `acp-omp`, and every provider with no row.
  - `bb.sdk.system.providerStates` gives the readiness of each provider on a host, and the plugin already reads it (`getProviderStates`).
- no-mistakes facts used (1.84.0, read from the binary's error text and the shipped config file):
  - `agent` is a top-level key of `$NM_HOME/config.yaml` (default `~/.no-mistakes/config.yaml`).
  - Its value is `auto`, one agent name, or an ordered list of names (`[codex, grok]`).
  - The valid names are `auto`, `claude`, `codex`, `grok`, `rovodev`, `opencode`, `pi`, `copilot`, `cursor`, `devin`, `antigravity`, and `acp:<target>`.
- Constraints: no credential of any kind, no write to no-mistakes configuration, offline conformance runs, lab path outside `/tmp` and outside any path that contains `firstmate`.
- Scale: two new modules, one new command, three edited tools, one schema block, one scenario, one fake lab, about a dozen decisions.

## Constitution check

| Principle | How the plan complies |
| --- | --- |
| I. Gates live in code and fail closed | `supervisor start` refuses on any failed read or failed check and spawns nothing. It applies the readiness, mode, model, and level checks through the one gate function that dispatch uses. The validator observation never reports a guess as ready. No gate is removed, and none is added to the state machine. |
| II. Machine core is pure | No change to `src/machine/`. The new pure modules sit in `src/harness/` and `src/validator/`, and `src/harness/` imports nothing. |
| III. Event log is the source of truth | The validator line is part of an event's evidence. Nothing is cached, and no state is derived from it. |
| IV. Storage behind an interface | No store change. |
| V. Test first | Every behavior in `tdd/test-list.md` gets a failing test first, recorded in `tdd/cycle-log.md`. The pure parts (parser, mapping, advice, schema) get table-driven unit tests. The command and the hand-off get tests through `runFactorymanCommand` and the plugin factory. S9 gets a scenario test against the fake lab and a live run per harness. |
| VI. Scope | **Needs an amendment.** Principle VI names the harness-independence tasks H5, H1, H11, H2, H10, and H3. H4 and H12 are not on that list, although the captain asked for them (decision D4 option B, "go with the recommendations"). The plan adds them to the scope line and bumps the constitution to 1.4.0 (minor: materially expanded scope guidance). D-123 to D-129 record the reason. The live install into the owner's bb stays the owner's step: every run happens in `bblab`. |
| Engineering constraints | No other bb plugin is called. `src/machine/` has no bb import. Docs follow the Google developer documentation style, one sentence per line. Firstmate's scripts, herdr, secondmates, relay, and away mode are not used. |

Result: one justified amendment (Principle VI), no violation, so no complexity tracking.
The post-design check (below) found no new issue.

## Decisions

### Q1. The supervisor's profile comes from the flag, then `roles.supervisor.profile`, and never from `default`

`default` is the worker's profile.
A supervisor that quietly takes it would carry the worker's harness, model, and permission mode, and the owner would not have chosen either.
Hard rule 8 and decision D5 already say that nothing picks a harness silently.
So the command refuses with both ways to choose a profile, and spawns nothing.

### Q2. The gate splits into admission and readiness

`gateProfile` runs `admit` first and then the reads and `checkProfile`.
The admission rule exists to confine workers (Pi's refusal in `local-only` is about a worker answering the merge form).
A supervisor is the owner's agent, so the report's decision D3 option C keeps Pi allowed as one.
The plan extracts the readiness half as `gateReadiness(bb, profile, host)` and leaves `gateProfile` as admission plus `gateReadiness`.
Dispatch and the queue still call `gateProfile`, so no worker path changes.

### Q3. `spawnSupervisor` is a new port method over the same adapter code

`spawnWorker` needs a parent thread and sets `parentNotifications: "off"`.
A supervisor has no parent.
The adapter factors the project lookup, the host choice, and the environment into one private function, and both methods call it.
The environment is the same as a worker's: a managed worktree off the project's default branch on the project's default host.
The conformance lab and the live-check guide already spawn the supervisor this way.
The metadata is exactly `{ role: "supervisor" }`.

### Q4. The default first prompt tells the supervisor to wait

`--prompt` is optional.
Without it, the prompt is "You are the factoryman supervisor. Wait for instructions." (the text of `docs/LIVE-CHECK.md`).
The conformance lab passes its own marker line through `--prompt`, so the fake model can tell its threads apart.

### Q5. The stamp reads the provider through `getThread`, which gains `providerId`

`ThreadInfo` gets `providerId: string | null`.
The adapter fills it from the thread.
The stamp command reads it after a successful stamp, so a thread bb rejects gets no advice.
A read that fails or a missing provider leads to the generic advice, which is the `clear` advice.
The `clear` advice is the step that makes the role reach the model on every harness in the table, and the `next-turn` advice is correct only where the table says so.
So an unknown provider gets the step that cannot leave the owner waiting for tools that never arrive.

### Q6. Advice text lives in a pure module and takes a contract row

`src/harness/advice.ts` exports `roleAdvice(threadId, providerId, row)` and returns text.
It imports only the contract types, so the unit tests need no bb and the text has one home.
The command passes `contractFor(providerId)`.

### Q7. `roles` is optional, strict, and normalized

The parsed `DispatchConfig` always carries `roles: { supervisor: { profile: string | null }, validator: { agent: "observe" } }`, with `null` and `observe` as the defaults, the same way `standingPermission` is always present.
`emptyDispatchConfig` carries the defaults.
`roles.supervisor.profile` is checked against `profiles` in the schema's refinement, like `default`.
`roles.validator.agent` is `z.literal("observe")`, so `inherit`, `set`, and every other value fail with the field in the message.
Every object inside `roles` is strict.
`dispatch init` keeps writing the file it writes today.

### Q8. The observation reads one file with one read-only command

The command is `sh -c 'f="${NM_HOME:-$HOME/.no-mistakes}/config.yaml"; if [ -f "$f" ]; then cat "$f"; else exit 3; fi'` through the plugin's `exec`, with the host of the pipeline and a 30-second bound.
`exec` already routes a command with a host to that machine, and `preflight` already runs `sh -c` there.
Exit 3 means "no file", which reads as the default `auto`.
Any other failure means "could not be observed".
The alternatives were `no-mistakes doctor` (human text, prints a runnable agent only, slow) and a YAML library (a new dependency for one key).
The parser is a small, tested reader for the one key in its three shapes (scalar, flow list, block list).
Anything it does not understand becomes "could not be observed", and never a guess.

### Q9. The mapping from agent to bb provider is a small table in the validator module

`claude` to `claude-code`, `codex` to `codex`, `pi` to `pi`, `acp:omp` to `acp-omp`, and `opencode`, `grok`, `cursor` to `acp-opencode`, `acp-grok`, `acp-cursor`.
Every other name maps to none, and its readiness is "not checked".
The table is not in `src/harness/contracts.ts`, because that table describes how a provider behaves as a worker or supervisor harness, and the validator is a different consumer.
A test pins the table.

### Q10. `auto` and lists

`auto` reports "no-mistakes picks the first runnable agent when the run starts" and lists the mapped providers that bb reports ready on the host.
It is ready when that list is not empty.
A list reports each agent in order.
It is ready when at least one entry is ready, because no-mistakes falls back down the list.
An agent with no mapping never counts as ready.

### Q11. The hand-off appends one line to its evidence and never refuses

The worker's evidence stays first.
The plugin adds a blank line and the validator line.
The hand-off is not refused when the agent is not ready, because the worker cannot fix a sign-in, and because the pipeline fails with its own error that the validation driver already reports.
Every failure inside the observation becomes text, so the report tool's refusal paths do not change.

### Q12. Preflight gains a check and a note

`runPreflight` keeps its `Problem[]` return, so the dispatch path and the queue keep working.
A new `preflightReport` returns `{ problems, notes }`, and `runPreflight` returns its problems.
For a `no-mistakes` project it adds a `validator_agent` problem when the agent is not ready or cannot be observed, and a note when it is ready.
`reportText` prints the notes.
Dispatch to a remote machine inherits the check, because it runs the same function, and a dispatch to a machine with an unready validator agent is refused as `preflight_failed`.
The host that holds the clone still gets no remote preflight.

### Q13. S9 becomes strict, and the fake lab models the seeded role

`Lab.startSupervisor` returns the new thread's ID.
S9 waits for the first turn, reads what the model was offered, and expects the four tools and the skill and no worker tool.
The real lab passes `--prompt` with its marker, and the lab's project file names `roles.supervisor.profile`, so the live run exercises the `roles` path and the unit tests exercise the flag.
The fake lab's `startSupervisor` seeds the role at spawn and needs no clear, and its stamp text follows the real advice.
The check that the stamp text has no clear advice for `next-turn` harnesses is added.

### Q14. The real runs come last and use the committed code

Each result file names the plugin commit.
So the code commits come first, then the runs, then one commit for the results and the support document.
A failure in a real run is a finding.
A cause in the tools is fixed.
A cause in bb or a harness is recorded, and the feature does not claim a pass it did not get.

### Q15. Skipped clarification, recorded

The spec has no `[NEEDS CLARIFICATION]` marker, and its Assumptions section records the four defaults chosen.
So `/speckit.clarify` was skipped, and D-123 records the skip with the assumptions it left open.

## Project structure

### Documentation (this feature)

```text
specs/011-supervisor-start-roles/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── supervisor-commands.md
│   ├── dispatch-roles.md
│   └── validator-observation.md
├── checklists/requirements.md
├── tasks.md
├── checklist.md
├── analyze.md
├── converge.md
└── tdd/ (test-list.md, cycle-log.md, verification.md)
```

### Source code

```text
src/
├── bb/port.ts, adapter.ts            # + spawnSupervisor, ThreadInfo.providerId
├── dispatch/types.ts, config.ts      # + roles
├── dispatch/gate.ts                  # + gateReadiness
├── harness/advice.ts                 # new: roleAdvice
├── validator/agent.ts                # new: parse, map, observe, describe
├── tools/supervisor-start.ts         # new: the start subcommand
├── tools/supervisor-command.ts       # route start, stamp advice, usage
├── tools/report.ts                   # validator line in the hand-off evidence
├── machines/preflight.ts             # validator_agent check, notes
└── server.ts                         # usage text
tools/conformance/
├── port.ts, real-lab.ts              # startSupervisor returns a thread ID
└── scenarios/s09-role-change.ts      # strict first-turn check
test/
├── fixtures/bb-port.ts, plugin-host.ts, conformance-lab.ts
└── acceptance/supervisor-start.test.ts, validator-observe.test.ts
conformance/known-gaps.json           # no entry left
conformance/results/*.json            # regenerated by the runs
docs/DECISIONS.md, CONFORMANCE.md, HARNESS-SUPPORT.md (generated), LIVE-CHECK.md, CUTOVER.md
.specify/memory/constitution.md       # 1.4.0
```

**Structure decision**: Keep the existing layout.
New code that has no bb dependency goes in `src/harness/` and `src/validator/`.
The command goes beside the other commands in `src/tools/`.

## Risks

- **The seeded role may not reach a harness's first turn.**
  The report observed it for workers on all four harnesses, and not for supervisors.
  The live S9 run decides it.
  If a harness fails, the feature records the conflict in `docs/DECISIONS.md` and does not hide it.
- **omp and Codex may need the clear even with a seeded role.**
  The report says the role cannot change after the first session, and says nothing about a role that is present at the first session.
  The live run decides.
- **The no-mistakes configuration may live elsewhere on a host.**
  The plugin reads the file as its own commands see `NM_HOME` and `HOME`, and the daemon may run with another environment.
  The evidence names the file it read, so a mismatch is visible, and D-126 records the limit.
- **A hand-off test may assert an exact list of `exec` calls.**
  The new read adds one call for a no-mistakes hand-off.
  Such a test is updated with the reason in the cycle log, and no assertion is loosened.
- **A change to a worker evidence string.**
  The `validating` evidence now has a second line.
  Tests and tools that read it by prefix still match.
- **The live runs take about 30 minutes** and need the pinned bb and its toolchain.
  A copy of the pin from an earlier lab avoids the network.

## Amendments after implementation

The text above is the plan that was approved, and it is not reworded.
These points record where the built feature differs from it or adds to it, and where the reason is written down.

- **Q6, the advice module.** `src/harness/` imports nothing, and the lint rule forbids even a type import. So `roleAdvice` takes a structural type (`RoleChangeFacts`) that a contract row fits, and the plan's sentence "it imports only the contract types" is superseded. See `tdd/cycle-log.md`, group 4.
- **Project structure.** The built feature also has `src/validator/agent.shell.test.ts` (it runs `READ_SCRIPT` under a real `sh`), `test/fixtures/validator-read.ts` (the one helper that routes the read), `test/acceptance/roles-config.test.ts`, `tools/conformance/wait.ts` with `wait.test.ts`, and edits to the fixtures `test/fixtures/runtime.ts` and `test/fixtures/bb-cli.json`.
- **The lab wait.** The spec and the plan do not call for a wait for bb's model catalog. The first live Pi run failed ten scenarios because the catalog was empty at the first dispatch, so the lab now waits up to 60 seconds for a model. D-132 records the reason.
- **Wording.** "First session" in the spec and "first turn" name the same moment: the session that bb builds for the thread's first turn.
- **Task references.** Two lines of `tasks.md` name the live-run tasks as `T038` to `T041` and `T038` to `T042`. After the rewrite of the task list they are `T040` to `T043`. Tasks `T053` and `T054` were added after the live runs and sit in phase 7 out of id order, because ticked tasks are never renumbered.
- **Data model and contract.** `data-model.md` and `contracts/validator-observation.md` now describe the observation shape and the no-file line as built.
