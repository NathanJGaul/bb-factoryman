---
feature: 014-registry-apply
loop: outside-in
profile: .specify/memory/tdd-profile.md
spec_criteria: 38
planned_at: 04d8272
updated_at: 04d8272
suite_baseline: green
---

# Test list: Registry apply

The acceptance layer is an in-process integration test.
It enters through the real plugin factory in the fake host (the registered CLI command `import-registry`, run through `world.host`'s CLI), through the store tables of the plugin's own database, and through the tracked documents.
It is weaker than a test against a real bb.
A fake host cannot show how a real `bb factoryman import-registry` prints in a terminal, or that bb passes the new flags through.
The only check of those is the live run in `bblab` (`docs/LIVE-CHECK.md`), which is the owner's step.
The suite baseline was 159 files and 2270 tests, all passing (about 134 s of test wall time, 3.5 minutes for `pnpm run check`).
Tests carry their behavior id in the title, for example `[U1901]`.
Table-driven tests cover the lines that name several inputs, and the cycle log records one red for the group.

## Outer loop: acceptance behaviors

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| A1901 | Through the plugin, a `direct-PR branch=wip/` line for `gizmos` with a bb project `gizmos` and the default stored config: `--apply --project gizmos` stores `direct-PR`, `yolo` off, and `wip/` for that project's ID, exits 0, and the output lists the written fields | US1.1, FR-001, FR-003, FR-007, FR-013 | example | PENDING | |
| A1902 | A `+yolo` line stores `yolo` on and says so; a bare `yolo` line is refused with exit 1, prints the flag, and stores nothing | US1.2, US1.3, FR-006, FR-007 | example | PENDING | |
| A1903 | A `no-mistakes-prod-only` line stores `no-mistakes` and prints the note; a line with no bracket stores `no-mistakes` with `yolo` off; `branch=` stores a null prefix; `forge=gerrit` writes, prints the forge note, and says the forge is not stored | US1.4, US1.6, US1.7, US1.8, FR-007, FR-008 | example | PENDING | |
| A1904 | A stored `baseBranch` and `defaultMachine` stay as stored and are listed as unchanged | US1.5, FR-009 | example | PENDING | |
| A1905 | A second run leaves every table identical and prints every field as unchanged with `Nothing was written.`; a stored config that differs in one field changes only that field; a stored `yolo` on with a line that has none becomes off | US2.1, US2.2, US2.3, FR-010, SC-003 | example | PENDING | |
| A1906 | Each refusal exits 1, names the reason, and leaves every table of the store identical: no registry line for the name, two lines, a flagged line of each kind (unknown mode, unexpected token, unclosed bracket), no bb project, two bb projects with the name, a bb list failure, a missing file | US3.3, US3.4, US3.5, US3.6, US3.7, US3.8, FR-004, FR-005, FR-006, SC-001 | example | PENDING | |
| A1907 | With eight projects in the file and one named, only the named project's row is written | US3, FR-003 | example | PENDING | |
| A1908 | After a successful apply exactly one `project_config` row differs and `task`, `task_event`, and `approval` are identical; the registry file's bytes and modification time are unchanged; no process ran | US5.1, US5.2, FR-011, FR-012, SC-002 | example | PENDING | |
| A1909 | A task created before the apply keeps its mode, and a task created after uses the new mode | US5.3 | example | PENDING | |
| A1910 | `docs/CUTOVER.md` shows `--apply --project`, no longer calls the apply path a follow-up, and still says tasks, approvals, and history are not imported and that firstmate is untouched; `docs/DECISIONS.md` has `### D-148` and D-078 and D-088 mention it; `docs/LIVE-CHECK.md` no longer says `--apply` is refused; the supervisor skill names `--apply --project` | US6.1, US6.2, US6.3, US6.4, FR-016 | example | PENDING | |
| A1911 | The new tests leak no temporary directory beyond the baseline count recorded in the cycle log | plan constraint | example | PENDING | |

## Inner loop: unit behaviors

### `src/limits/registry-apply.ts`

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U1901 | A clean entry gives a plan whose three changes hold stored and target values of `deliveryMode`, `yolo`, and `branchPrefix`, an empty prefix as null, `no-mistakes-prod-only` as `no-mistakes`, and `untouched` lists `baseBranch` and `defaultMachine` with their stored values | US1, FR-007, FR-008, FR-009 | example | PENDING | |
| U1902 | Refusal table: no entry, two entries with one name, a flagged entry (unknown mode, unexpected token, unclosed bracket, bare `yolo`), no bb project, two bb projects with the name in any letter case; and a case-insensitive match that succeeds | US3, FR-004, FR-005, FR-006 | example | PENDING | |
| U1903 | `next` is null when every field equals the target; a change is flagged only when its values differ (both sides: one field differs, none differs); a stored `yolo` on with an entry that has none changes to off; `next` keeps the stored `baseBranch` and `defaultMachine` | US2, FR-010 | example | PENDING | |

### `src/tools/supervisor-command.ts`

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U1904 | Argument table: `--apply` alone, `--project` alone, `--project` twice, `--project` with no value or a `--` value, an unknown flag, and a stray argument each print the usage with exit 2 and read nothing | US3.1, US3.2, US3.9, FR-002 | example | PENDING | |
| U1905 | An apply writes the config, prints `Applied registry line`, lists `written:` and `unchanged:`, and reads only the registry file | US1, FR-013 | example | PENDING | |
| U1906 | A no-op run calls `putProjectConfig` zero times | US2.1, FR-010 | example | PENDING | |
| U1907 | Each refusal exits 1 with a message holding the reason and the project name; a list failure logs a warning; a flagged refusal prints the flags | US3, FR-004 to FR-006 | example | PENDING | |
| U1908 | When `putProjectConfig` throws, the stored config is unchanged, the exit code is 1, and the message says the write failed | US3.10, FR-014 | example | PENDING | |
| U1909 | The dry-run output is byte-identical to a pinned copy of today's, and the dry run never calls `putProjectConfig` | US4.1, FR-001 | characterization | PENDING | |
| U1910 | The server's registration of `import-registry` shows `--apply` and `--project <name>` in its usage, and the usage text matches | US4.2, FR-015 | example | PENDING | |

## Invariants and edge cases still to place

- None. Every edge case in the spec maps to a line above: case-insensitive names (U1902), a missing `branch=` token gives `fm/` (A1903), `--apply` or `--file` twice (U1904).

## Out of scope

- Importing tasks, approvals, or history: not requested.
- A cancel-queued-task tool, tool hints, real-model runs: named out of scope by the task.
- Applying all projects at once: forbidden by the task.
- Writing `baseBranch`, `defaultMachine`, or the forge: no registry source.
- Mutation tooling: the profile has none; `/speckit.tdd.verify` uses deliberate mutants.

## Verification commands

- Single test: `pnpm vitest run {file} -t "{name}"`
- File: `pnpm vitest run {file}`
- Suite: `pnpm test`
- Gate: `pnpm run check` (type check, lint, tests)
- Acceptance: `pnpm vitest run {file}`
