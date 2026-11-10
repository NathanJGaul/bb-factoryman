---
feature: 013-factoryman-decide-tool
loop: outside-in
profile: .specify/memory/tdd-profile.md
spec_criteria: 39
planned_at: c275f91
updated_at: c275f91
suite_baseline: green
---

# Test list: The `factoryman_decide` tool

The acceptance layer is an in-process integration test.
It enters through the real plugin factory in the fake host (`factoryman_decide`, `factoryman_report`, the registered renderers, `agents.configure`), through the registered app (`renderSlot` on the decision renderer), through the conformance runner's `main(argv, deps)` with the fake lab behind it, and through the tracked documents.
It is weaker than a test against a real bb.
A fake host cannot show how the form looks (jsdom has no layout), that a real bb draws the custom renderer, or that a real no-mistakes install behaves as the recorded output does.
The only checks of those are the live runs: behavior A1818 is a live check (tier 1 and tier 1.5, offline, in `bblab`), and task T032 tries the form in the isolated lab.
The suite baseline was 152 files and 2076 tests, all passing (about 85 s for `pnpm run check`, 63 s for `pnpm test`).
Tests carry their behavior id in the title, for example `[U1801]`.
Table-driven tests cover the lines that name several inputs, and the cycle log records one red for the group.

The baseline had one red test at first, `[A1510]`, because the new spec files cited D-136 to D-143 before the log had those headings.
The headings were written (commit `docs(decisions)`), and the suite was green again before any behavior was planned on top of it.

## Outer loop: acceptance behaviors

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| A1801 | Through the plugin, a task parked on a gate of two findings: `factoryman_decide` with the current key and `fix` of one finding with instructions opens exactly one form, the validator receives that answer (finding ID and instructions as given, with the worktree path) only after the owner approves, the task is `validating`, and its `resolve` row names the answer and the owner's approval | US1.1, US1.2, US1.4, FR-003, FR-008, FR-012, SC-001 | example | DONE | `test/acceptance/tools-decide.test.ts::[A1801]` |
| A1802 | `approve` and `skip` reach the validator after approval with that action and no finding IDs | US1.3, FR-006 | example | DONE | `test/acceptance/tools-decide.test.ts::[A1802]` |
| A1803 | When the validator rejects an approved answer, the task stays `needs_decision`, no `resolve` row is written, and the tool text gives the validator's reason | US1.5, FR-012 | example | DONE | `test/acceptance/tools-decide.test.ts::[A1803]` |
| A1804 | With the real `NoMistakesValidator` over a recording command runner, the answer's command line is `axi respond --action fix --findings <ids> --instructions <text> --wait <w>` and holds no `--yes` and no `-y`, and the run's other commands hold neither | US1.6, FR-015, SC-004 | example | DONE | `test/acceptance/tools-decide.test.ts::[A1804]` |
| A1805 | Each wrong call is refused before a form opens, sends nothing to the validator, and changes neither the state nor the log: a task not in `needs_decision`, a scout task, an unknown task, a task of another project, a worker caller, an unknown action, an unknown argument, a key that does not match (the text names the live key and the live finding IDs), a `fix` with an unknown, missing, or duplicate finding ID, `instructions` with `approve` or `skip`, and `rerun` on a gate | US3.1, US3.2, US3.3, US3.4, US3.5, US3.9, US3.10, FR-001, FR-002, FR-003, FR-005, FR-006, SC-002 | example | DONE | `test/acceptance/tools-decide.test.ts::[A1805]` |
| A1806 | With `yolo` on, the form opens for an `ask-user` finding, and the validator receives the answer only after the owner approves | US3.6, FR-008, SC-003 | example | DONE | `test/acceptance/tools-decide.test.ts::[A1806]` |
| A1807 | A denial, a cancel, a timeout, and the replies `{decision:"approved",extra:1}`, `{decision:"yes"}`, `"approved"`, and `null` each send nothing, leave the task `needs_decision`, leave the event log unchanged, and say in the text what happened | US3.7, FR-010, FR-017, SC-001 | example | DONE | `test/acceptance/tools-decide.test.ts::[A1807]` |
| A1808 | When the live gate has another key after the owner approves, or the task has left `needs_decision` while the form was open, nothing is sent and the text says the gate changed | US3.8, FR-011 | example | DONE | `test/acceptance/tools-decide.test.ts::[A1808]` |
| A1809 | A second call for a task whose form is open is refused and opens no second form, and a call after the first form closes opens a new one | US3.11, FR-016 | example | DONE | `test/acceptance/tools-decide.test.ts::[A1809]` |
| A1810 | A failing or unreadable `validator.status` makes the call fail closed with no form and no answer | US3.12, FR-004 | example | DONE | `test/acceptance/tools-decide.test.ts::[A1810]` |
| A1811 | A task parked on a `passed-with-override` run: `rerun` with the current key opens a form that carries the outcome, calls no validator `answer`, records `resolve` with the owner's approval after approval, and the driver then calls `start` | US4.1, US4.2, FR-007, FR-013 | example | DONE | `test/acceptance/tools-decide.test.ts::[A1811]` |
| A1812 | `rerun` on a gate, `approve`, `skip`, and `fix` on a finished run, and any call on a running, `failed`, or `cancelled` view are each refused with the reason and send nothing | US4.3, US4.4, US4.5, FR-007 | example | DONE | `test/acceptance/tools-decide.test.ts::[A1812]` |
| A1813 | The `finding` event that parks a task holds the line `Decision key: <key>`, and the wake message to the supervisor shows it | FR-005 | example | DONE | `test/acceptance/tools-decide.test.ts::[A1813]` |
| A1814 | The registered decision renderer, mounted with `renderSlot` and a payload that the tool built, shows the findings and the exact answer, and its Approve click gives a reply that the tool's strict schema accepts | US2.1, US2.3, FR-009, FR-019 | example | DONE | `test/acceptance/decision-approval-form.test.tsx::[A1814]` |
| A1815 | The registered merge renderer still renders the merge payload and nothing else changed in `src/app.tsx` | FR-019 | example | DONE | `test/acceptance/decision-approval-form.test.tsx::[A1815]` |
| A1816 | `agents.configure` offers a supervisor thread the five supervisor tools with `factoryman_decide` last, a worker only `factoryman_report`, and a thread with no role none; the factory registers six tools (`plugin.test.ts` `[A17]`, `server.test.ts` `[U123]`, `register.test.ts` `[U1825]`) | US5.1, US5.2, US5.3, FR-001 | example | DONE | `test/acceptance/tools-visibility.test.ts::[A1816]` |
| A1817 | The conformance runner with the fake lab passes S5, S8, and S9 for the stub and the four drivers with five supervisor tools and the S8 decide check, and `conformance/known-gaps.json` lists no entry | US5.4, US5.5, FR-020 | example | DONE | `test/acceptance/conformance-tier1.test.ts::[A1817]`, `test/acceptance/conformance-tier15.test.ts::[A1817]` |
| A1818 | LIVE CHECK: the five offline runs (tier 1, and tier 1.5 for Claude Code, Codex, Pi, and omp) exit 0 with a clean isolation check, show five supervisor tools in S5 and S9 and the S8 decide check passing, and the support document lists no known gap | US5.6, FR-021, SC-005, SC-006 | live | DONE | `conformance/results/*.json` and `docs/HARNESS-SUPPORT.md` |
| A1819 | The tracked documents agree with the code: the design lists the tool and the counts, the log has D-136 on with amended-by lines, the constitution is 1.5.0 without the "stays out" clause, the supervisor skill tells the supervisor to use the tool, and no document says the supervisor has four tools | US4.6, US6.1, US6.2, US6.3, US6.4, FR-022, FR-023, FR-024, SC-008 | example | DONE | `test/acceptance/design-profiles.test.ts::[A1710]`, `test/acceptance/decision-log.test.ts::[A1819]`, `test/acceptance/skills.test.ts::[A1819]` |
| A1820 | A full run leaves no `bb-fake-plugin-host-*` directory behind, and the new tests make none outside their private `TMPDIR` | US6.5, FR-026, SC-007 | example | DONE | `test/acceptance/tmpdir-leak.test.ts::[A1511]` |
| A1821 | The registered decision renderer mounted with an unreadable payload shows an alert and no Approve, Deny and Cancel still work, and a finding description with markup is shown as text and creates no element | US2.2, US2.4, FR-018 | example | DONE | `test/acceptance/decision-approval-form.test.tsx::[A1821]` |

## Inner loop: unit behaviors

### `src/validator/key.ts`

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U1801 | A gate view gives the key `nm-<runId>-<step>-<8 hex>` | FR-005 | example | DONE | `src/validator/key.test.ts::[U1801]` |
| U1802 | A finished view gives `nm-<runId>-<outcome>-<8 hex>`, a null run ID gives `unknown`, and a running view gives `running` in the middle part | FR-005 | example | DONE | `src/validator/key.test.ts::[U1802]` |
| U1803 | Equal views give equal keys, and a change of status, finding ID, finding order, outcome, run ID, or phase changes the key (each field alone) | FR-005 | example | DONE | `src/validator/key.test.ts::[U1803]` |
| U1804 | After `viewSignature` moves, the driver still keeps a task parked while the view equals the parking view, resolves when it changed, and takes the first view after a restart as the baseline | FR-005 | characterization | BASELINE | `src/validator/driver.test.ts::[U188]`, `[U189]`, `[U207]` |

### `src/validator/driver.ts`

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U1805 | The evidence of the `finding` event for a gate keeps its earlier lines and ends with the line `Decision key: <key>` (`[U187]` is updated to expect the extra line) | FR-005 | example | DONE | `src/validator/driver.test.ts::[U1805]`, `[U187]` |
| U1806 | The evidence for a finished run that parks the task (override, skips, passed, no pull request) ends with the key line, and still holds the outcome text | FR-005, FR-007 | example | DONE | `src/validator/driver.test.ts::[U1806]` |
| U1807 | The park after five validator errors has no key line | FR-005 | example | DONE | `src/validator/driver.test.ts::[U1807]` |
| U1808 | `current` returns the view from `validator.status` with the worktree path and the host of the task (a remote task too) and writes no event | FR-004 | example | DONE | `src/validator/driver.test.ts::[U1808]` |
| U1809 | `current` returns `ok: false` with a message when the worktree path is unreadable, the status call fails, or its output is unreadable | FR-004 | example | DONE | `src/validator/driver.test.ts::[U1809]` |
| U1810 | `answer` with an `evidence` argument records that text on `resolve`, and without one keeps the default text | FR-012 | example | DONE | `src/validator/driver.test.ts::[U1810]` |
| U1811 | `rerun` in `needs_decision` records `resolve` with the actor and the evidence, calls no validator operation, and clears the baseline; outside `needs_decision` it returns `ok: false` and the machine logs the refusal | FR-013 | example | DONE | `src/validator/driver.test.ts::[U1811]` |
| U1812 | After `rerun` the loop calls `start` | FR-013 | example | DONE | `src/validator/driver.test.ts::[U1812]` |
| U1844 | The loop never answers a gate while it follows a run | FR-015 | example | DONE | `src/validator/driver.test.ts::[U194]` |

### `src/approval/contract.ts`

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U1813 | The decision renderer ID is `factoryman-decision-approval` and differs from the merge ID | FR-009 | example | DONE | `src/approval/contract.test.ts::[U1813]` |
| U1814 | `readDecisionPayload` returns a valid gate payload and a valid finished-run payload unchanged | FR-009 | example | DONE | `src/approval/contract.test.ts::[U1814]` |
| U1815 | `readDecisionPayload` returns null for a non-object, an array, null, an extra key at any level, a missing key, a wrong type, a `kind` or `answer.action` outside its set, an `answer.findingIds` entry that is not in `findings`, a `fix` with no IDs, and a finding with an extra key | FR-009, FR-018 | example | DONE | `src/approval/contract.test.ts::[U1815]` |

### `src/tools/decide.ts`

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U1816 | `decideSchema` is strict: it refuses an unknown key, a missing `key`, an empty `taskId`, and an action outside the four | FR-002 | example | DONE | `src/tools/decide.test.ts::[U1816]` |
| U1817 | For a pending gate: `approve` and `skip` pass with no IDs and no instructions; they refuse IDs and refuse instructions; `fix` passes with one ID or all IDs of the gate, and refuses no IDs, an empty list, a duplicate ID, an ID not in the gate, and a gate with no findings; blank instructions count as absent; `rerun` is refused | FR-006 | example | DONE | `src/tools/decide.test.ts::[U1817]` |
| U1818 | For a finished view: `rerun` passes for `passed`, `passed-with-override`, `passed-with-skips`, and `checks-passed` with no pull request; it is refused for `checks-passed` with a pull request, `failed`, `cancelled`, and a running view; `approve`, `skip`, and `fix` are refused for every finished view | FR-007 | example | DONE | `src/tools/decide.test.ts::[U1818]` |
| U1819 | `decisionRequest` builds the payload: a gate gives `kind: "gate"` with the findings verbatim, `answer.instructions` is `""` when none; a finished run gives `kind: "finished"`, empty `findings`, and the outcome | FR-009 | example | DONE | `src/tools/decide.test.ts::[U1819]` |
| U1820 | `decisionEvidence` names the action, the finding IDs, the instructions, the key, and the owner's comment, and for `rerun` the outcome | FR-012, FR-013 | example | DONE | `src/tools/decide.test.ts::[U1820]` |
| U1821 | With a fake `Decider` the tool reads the live view twice, opens one form, and sends the answer once with the evidence of U1820 | FR-011, FR-012 | example | DONE | `src/tools/decide.test.ts::[U1821]` |
| U1822 | When the send fails and the task is no longer `needs_decision`, the text says that the task moved on | FR-011 | example | DONE | `src/tools/decide.test.ts::[U1822]` |
| U1823 | When the machine would refuse `resolve`, nothing is sent | FR-014 | example | DONE | `src/tools/decide.test.ts::[U1823]` |
| U1848 | A call on a running view, a failed run, a cancelled run, or `checks-passed` with a pull request is refused through the tool, opens no form, and sends nothing | FR-007 | example | DONE | `src/tools/decide.test.ts::[U1848]` |

### `src/tools/register.ts` and `src/server.ts`

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U1824 | `toolsForMetadata` returns five names for a supervisor, the last one `factoryman_decide`; the worker and no-role results are unchanged (`[U33]` is updated to five) | FR-001 | example | DONE | `src/tools/register.test.ts::[U1824]`, `[U33]` |
| U1825 | `registerTools` registers six names and no seventh (`[U36]` is updated), the `factoryman_decide` parameters are one flat object whose `action` is an enum with no `oneOf` or `anyOf`, and a call reaches `decide` | FR-001, FR-002 | example | DONE | `src/tools/register.test.ts::[U1825]`, `[U36]` |
| U1826 | DROPPED: the plugin-level proof that the driver reaches the tool is A1801, which runs through `createPlugin` with the real driver (`[U123]` is updated to six tools in cycle 4) | FR-001, FR-004 | example | DROPPED | `src/server.test.ts::[U1826]`, `[U123]` |
| U1843 | The approval-timeout setting is labelled "Approval timeout (minutes)" | D-139 | example | DONE | `src/server.test.ts::[U1843]` |

### `src/app/decision-approval-form.tsx` and `src/app.tsx`

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U1828 | The form shows the task, the key, the step and status, each finding's five fields, and the answer sentence for `approve`, `skip`, and `fix` with IDs and instructions | FR-009, US2.1 | example | DONE | `src/app/decision-approval-form.test.tsx::[U1828]` |
| U1829 | A finished-run payload shows the outcome and no findings list, and the sentence says that approval starts a new run | FR-009, US4.1 | example | DONE | `src/app/decision-approval-form.test.tsx::[U1829]` |
| U1830 | An unreadable payload shows an alert and no Approve, and Deny and Cancel work | FR-018, US2.2 | example | DONE | `src/app/decision-approval-form.test.tsx::[U1830]` |
| U1831 | Approve submits `{decision:"approved"}` with the trimmed comment, Deny submits `denied` with the comment, Cancel cancels, a second click while one is in flight does nothing, and a failed submit shows the reason and enables the buttons again | FR-018, US2.3 | example | DONE | `src/app/decision-approval-form.test.tsx::[U1831]` |
| U1832 | A finding description with markup renders as text and creates no element | FR-018, US2.4 | example | DONE | `src/app/decision-approval-form.test.tsx::[U1832]` |
| U1833 | The app registers the merge renderer and the decision renderer under their two IDs | FR-019 | example | DONE | `src/app.test.tsx::[U1833]` |

### Wording that counts the tools

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U1834 | Both advice lines say "five supervisor tools" | SC-008 | example | DONE | `src/harness/advice.test.ts::[U1834]` |
| U1835 | The start output, the stamp output, and the CLI summary say "five" | SC-008 | example | DONE | `src/tools/supervisor-start.test.ts::[U1835]`, `src/tools/supervisor-command.test.ts::[U1835]`, `tools/conformance/readers.test.ts::[U1835]`, `test/fixtures/conformance-lab.test.ts::[U1835]` |

### `tools/conformance` and the fake lab

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U1837 | S5 and S9 pass when a supervisor is offered five tools and fail when `factoryman_decide` is missing | FR-020, US5.4 | example | DONE | `tools/conformance/scenarios/scenarios.test.ts::[U1837]` |
| U1838 | S8's `S8.decide-wrong-state` passes when the lab refuses the call with an error that names `needs_decision` and leaves the state `working`, and fails when the lab resolves the task or changes its state | FR-020, US5.5 | example | DONE | `tools/conformance/scenarios/scenarios.test.ts::[U1838]` |
| U1839 | The fake lab's `factoryman_decide` refuses a task that is not in `needs_decision` with the real tool's wording and writes no `resolve` row | FR-020 | example | DONE | `test/fixtures/conformance-lab.test.ts::[U1839]` |
| U1847 | S9's tool checks fail when the started or the stamped supervisor lacks `factoryman_decide` | FR-020, US5.4 | example | DONE | `tools/conformance/scenarios/scenarios.test.ts::[U1847]` |

### Documents and the skill

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U1836 | The supervisor skill lists `factoryman_decide` in its tool table, has a section that tells the supervisor to read the findings and the key from the wake message, to call the tool, and that the owner approves, and no longer says "You cannot answer a finding" | FR-024, US6.4 | example | DONE | `test/acceptance/skills.test.ts::[U1836]` |
| U1840 | The design says the supervisor has five tools and a worker a sixth, lists `factoryman_decide` in the tool table, has an authority-gates row for a pipeline finding, and the "Supervisor start" paragraph says five | FR-022, US6.1 | example | DONE | `test/acceptance/design-profiles.test.ts::[A1710]` |
| U1841 | The constitution is 1.5.0 and Principle VI cites D-136 and no longer says `factoryman_decide` stays out; D-031 and D-057 carry an `Amended by` line that names a decision with a heading | FR-023, US6.2, US6.3 | example | DONE | `test/acceptance/decision-log.test.ts::[A1618]`, `::[U1841]` |
| U1842 | `docs/CONFORMANCE.md` and `docs/LIVE-CHECK.md` say five where they count the supervisor's tools | SC-008 | example | DONE | `test/acceptance/conformance-docs.test.ts::[U1842]`, `test/acceptance/live-check.test.ts::[U1842]` |
| U1845 | Every decision number that a tracked file cites has a heading, and no number has two | FR-023 | example | DONE | `test/acceptance/decision-log.test.ts::[A1509]`, `::[A1510]` |
| U1846 | The adapter never passes `--yes` or `-y` in any operation | FR-015 | example | DONE | `src/validator/no-mistakes.test.ts::[U180]` |

## Invariants and edge cases still to place

- The owner approves after the form's timeout: bb reports the form as cancelled, so nothing is sent (covered by the timeout row of A1807).
- A restart while a form is open ends the wait and sends nothing (the same behavior as the merge form; no new test, because the fake host has no restart of a pending form).
  Recorded as a limit in D-140's text if a test cannot show it.
- A finding's text with control characters is kept verbatim in the tool result and the log (a row of A1801's payload check).
- The finding list is long: the form scrolls, and the tool result never clips an ID (a row of U1828 with 40 findings).

## Out of scope

- Tier 2 real-model runs and any credential: the captain shelved them.
- Branch protection work and the owner-typed approval code (D-095).
- A new machine event, a new guard, or a `record_approval` scope for decisions (D-140, D-141).
- Moving a parked task to `review_ready` after an override or skipped steps (D-141).
- A tool that fails or cancels a task for the supervisor.
- Any change to how the validator runs: the adapter's command lines, flags, and the polling loop's timing.
- A conformance scenario that reaches `needs_decision` (D-142): the lab has no `no-mistakes` project.
- A mutation-testing tool: the profile has none, so `/speckit.tdd.verify` uses deliberate mutants.

## Verification commands

Copied verbatim from `.specify/memory/tdd-profile.md`:

- Single test: `pnpm vitest run {file} -t "{name}"`
- File: `pnpm vitest run {file}`
- Full suite: `pnpm test`
- Acceptance: `pnpm vitest run {file}`
- Coverage: none (`@vitest/coverage-v8` is not installed)
- Mutation: none (StrykerJS is not installed); deliberate mutants are used
- The combined gate: `pnpm run check`
