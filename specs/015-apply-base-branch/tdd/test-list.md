---
feature: 015-apply-base-branch
loop: outside-in
profile: .specify/memory/tdd-profile.md
spec_criteria: 18
planned_at: c1ee439
updated_at: c1ee439
suite_baseline: green
---

# Test list: Apply a base branch

The acceptance layer is an in-process integration test.
It enters through the real plugin factory in the fake host (the registered CLI command `import-registry`), through the store tables of the plugin's own database, and through the two real consumers of the stored base branch (`worktreeReport` and the local merge preflight).
It is weaker than a test against a real bb.
A fake host cannot show how a real `bb factoryman import-registry` prints in a terminal.
The live run in `bblab` (`docs/LIVE-CHECK.md`) is the owner's step.
The suite baseline was 162 files and 2340 tests, all passing (about 30 s).
Tests carry their behavior id in the title, for example `[U1501]`.
Table-driven tests cover lines that name several inputs, and the cycle log records one red for the group.
Acceptance tests are written before the code they cover (D-149).

## Outer loop: acceptance behaviors

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| A1501 | Through the plugin, a `local-only` line applied with `--base-branch main` stores `local-only` and `main`, exits 0, and the output lists `baseBranch: (none) -> main` as written; a stored `develop` becomes `main` and the output shows both values; a `direct-PR` line stores the value the same way | US1.1, US1.2, US1.5, FR-004 | example | TODO | |
| A1502 | The bug reproduction: after an apply without the flag, `worktreeReport` and the local merge preflight fed the stored config refuse with the "needs a base branch" message; after an apply with the flag they do not | US1.4, SC-001 | example | TODO | |
| A1503 | Without the flag the stored `baseBranch` stays and is listed as unchanged `(not in the registry)`; a `local-only` result with no base branch prints the `Warning:` line, also on a rerun that writes nothing; there is no warning for `direct-PR` with none, for `local-only` with a stored base branch, or after the flag | US2.1, US2.2, US2.3, US2.4, FR-006, FR-007 | example | TODO | |
| A1504 | Each usage error, invalid name, and existing refusal with the flag present leaves every table of the store identical: `--base-branch` without `--apply`, no value, a `--` value, twice, an invalid name, no registry line, a flagged line, an unknown bb project, a bb list failure | US3.1, US3.2, US3.3, US3.4, FR-001, FR-002, FR-003, SC-002 | example | TODO | |
| A1505 | A rerun with the same flag leaves every table identical and prints every field as unchanged with `Nothing was written.`; a first apply changes one `project_config` row and leaves `task`, `task_event`, and `approval` identical | US1.3, FR-005, FR-008, SC-003 | example | TODO | |
| A1506 | The server's `import-registry` registration usage and the live-check expected flag list show `--base-branch` | US4.2, FR-009 | example | TODO | |
| A1507 | `docs/CUTOVER.md` shows `--base-branch`, says a `local-only` project needs it, and no longer says the base branch is never written; `docs/DECISIONS.md` has D-150 and D-037, D-078, and D-148 mention it; `docs/LIVE-CHECK.md` and the supervisor skill mention the flag | US4.1, US4.3, US4.4, FR-009 | example | TODO | |

## Inner loop: unit behaviors

### `src/limits/registry-apply.ts`

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U1501 | `checkBranchName` is null for `main`, `release/1.0`, `feature/a_b-c`, and `v1.2`, and gives a reason for each of: empty, blank, leading or trailing space, `-x`, `--x`, `a b`, tab, newline, `a..b`, `a~b`, `a^b`, `a:b`, `a?b`, `a*b`, `a[b`, `a\b`, `a@{b`, `a//b`, `/a`, `a/`, `a.`, `a.lock`, `@` | US3.3, FR-003 | example | TODO | |
| U1502 | `planApply` with `baseBranch: "main"` lists `baseBranch` in `changes` with stored and target values, flags `changed` only when they differ, omits it from `untouched`, and puts it in `next` | US1.1, US1.2, US1.3, FR-004, FR-005 | example | TODO | |
| U1503 | `needsBaseBranch` is true for a `local-only` result with no stored or given base branch, false when a stored or given one exists, and false for `direct-PR` and `no-mistakes` with none; without the flag `untouched` still lists `baseBranch` | US2.1, US2.2, US2.3, FR-006, FR-007 | example | TODO | |

### `src/tools/supervisor-command.ts`

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U1504 | Argument table: `--base-branch` without `--apply`, with no value, with a `--` value, or given twice prints the usage with exit 2 and reads nothing; an invalid name exits 2, names the broken rule, and reads nothing | US3.1, US3.2, US3.3, FR-001, FR-002, FR-003 | example | TODO | |
| U1505 | With a valid name the output lists `baseBranch` under `written:` (old -> new) or `unchanged:`, and a rerun prints `Nothing was written.` | US1.1, US1.3, FR-004, FR-005 | example | TODO | |
| U1506 | The warning line has the exact text of `contracts/cli.md` | US2.2, FR-007 | example | TODO | |
| U1507 | When `putProjectConfig` throws with the flag present, the stored config is unchanged and the exit code is 1 | US3.5 | example | TODO | |

## Invariants and edge cases still to place

- The apply does not check that the branch exists (spec edge case). Not a test: there is no behavior to observe.
- `--base-branch` before or after the other flags works the same: covered in U1504's table.
- The dry run never takes the flag: covered by U1504 (`--base-branch` without `--apply`).

## Out of scope

- The scout report file (finding 3) and every other finding.
- Writing `defaultMachine` or the forge.
- Reading `baseBranch` from `workflow.json`, or inferring it.
- Checking that the branch exists.

## Verification commands

- Single test: `pnpm vitest run {file} -t "{name}"`
- File: `pnpm vitest run {file}`
- Suite: `pnpm test`
- Acceptance: `pnpm vitest run {file}`
- Coverage and mutation: none configured. Deliberate mutants stand in (task T011).
