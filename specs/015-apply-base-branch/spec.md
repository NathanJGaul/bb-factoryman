# Feature specification: Apply a base branch

**Feature branch**: `fm/bb-factoryman-base-branch-gap`

**Created**: 2026-11-12

**Status**: Approved (scope fixed by the captain's request on 2026-11-12 and the Firstmate spec for this task)

**Input**: After `import-registry --apply --project <name>`, a `local-only` project cannot merge or tear down.
The apply never writes `baseBranch` (D-037, D-078, D-148), because firstmate's registry has no base branch.
The local merge and the landed-work check then refuse with "A local-only project needs a base branch ... and none is configured."
The manual test plan found this in cases C-03 and E-01 (finding 1), and `docs/CUTOVER.md` does not mention it.
This feature lets the owner type the base branch on the apply command.
It records the decision as D-150.

## User scenarios and testing

The person who uses this feature is the owner, who runs the command in a terminal during a cutover.
There is no screen.
The real entry point is `runFactorymanCommand`, which `bb factoryman import-registry` calls, and the stored project config that merge and teardown read.

### User story 1 - Store the base branch while applying a project (priority: P1)

The owner applies a `local-only` project and adds `--base-branch main`.
The plugin writes the mode, `yolo`, and prefix as before, and also stores `main` as the project's base branch.
Merge and teardown then work for that project.

**Why this priority**: Without it, the cutover steps leave a `local-only` project unable to finish a task, and the owner has to write the database by hand.

**Independent test**: Load the plugin into the fake host with a bb project list and a registry file, run the command with `--apply --project <name> --base-branch main`, and read the stored config back.

**Acceptance scenarios**:

1. **Given** a `local-only` registry line and a bb project with the default stored config, **When** the owner runs the apply with `--base-branch main`, **Then** the stored config holds `local-only` and base branch `main`, and the output lists `baseBranch: (none) -> main` as written.
2. **Given** the stored base branch is `develop`, **When** the owner applies with `--base-branch main`, **Then** it becomes `main`, and the output shows the old and new value.
3. **Given** the stored base branch already equals the flag, **When** the owner runs the same command again, **Then** nothing is written, the field is listed as unchanged, and the exit code is 0.
4. **Given** a project applied with `--base-branch main`, **When** a task reaches merge or teardown, **Then** the "needs a base branch" refusal no longer fires (the existing landed-work and merge checks run against `main`).
5. **Given** a `direct-PR` or `no-mistakes` line, **When** the owner applies with `--base-branch`, **Then** the value is stored the same way, because the store has one base branch per project and dispatch starts worktrees from it.

### User story 2 - Without the flag nothing changes, and the output says what is missing (priority: P1)

The owner applies without the flag.

**Why this priority**: The flag is an explicit opt-in.
The command must not guess a base branch, because the base branch decides the landed-work check (D-078).

**Independent test**: Run the apply without the flag and compare the stored config and the output.

**Acceptance scenarios**:

1. **Given** no `--base-branch`, **When** the owner applies, **Then** the stored `baseBranch` stays as stored, and the output lists it as unchanged exactly as before.
2. **Given** the resulting mode is `local-only` and the resulting base branch is none, **When** the apply ends, **Then** the output adds a line that says merge and teardown refuse until the owner runs the command again with `--base-branch <name>`.
3. **Given** the resulting mode is `local-only` and a base branch is stored, or the mode is another mode, **When** the apply ends, **Then** the output has no such line.
4. **Given** the apply writes nothing (a rerun) and the project is still `local-only` with no base branch, **When** the apply ends, **Then** the output still has the line.

### User story 3 - The flag refuses bad input before anything is read or written (priority: P1)

**Why this priority**: The base branch decides the landed-work check, so a wrong value loosens a gate or breaks `git` calls (a value that starts with `-` becomes a `git` option).

**Independent test**: Run the command with each bad value and compare the whole store before and after.

**Acceptance scenarios**:

1. **Given** `--base-branch` without `--apply`, **When** the command runs, **Then** it prints the usage, exits 2, reads nothing, and writes nothing.
2. **Given** `--base-branch` with no value, with a value that starts with `--`, or given twice, **When** the command runs, **Then** it prints the usage, exits 2, and reads nothing.
3. **Given** a value that is not a valid branch name (empty or blank, starts with `-`, has a space or control character, has `..`, ends with `/` or `.lock`, or has one of `~ ^ : ? * [ \`), **When** the command runs, **Then** it exits 2, says which rule the value breaks, and writes nothing.
4. **Given** any refusal from the existing apply (no line, flagged line, unknown or ambiguous project), **When** the flag is also present, **Then** the refusal and its exit code are unchanged and nothing is written.
5. **Given** the write fails, **When** the flag is present, **Then** the stored config is unchanged and the command exits 1.

### User story 4 - The docs and help match the behavior (priority: P2)

**Acceptance scenarios**:

1. **Given** `docs/CUTOVER.md`, **When** it is read, **Then** the apply step shows `--base-branch`, says that a `local-only` project needs it, and "What the import does not do" no longer says the base branch is never written.
2. **Given** the usage text, `--help` listing, and the server's command registration, **When** the owner reads them, **Then** they show `--base-branch <name>`.
3. **Given** `docs/DECISIONS.md`, **When** it is read, **Then** D-150 records the decision, and D-037, D-078, and D-148 point to it.
4. **Given** `docs/LIVE-CHECK.md` and the supervisor skill, **When** they mention what the apply writes, **Then** they match.

### Edge cases

- The apply does not check that the branch exists, because it runs no process (D-148).
  Merge and the landed-work check read the real checkout later and refuse on a wrong name.
- Branch names are case-sensitive and the plugin stores the value as typed (surrounding space is a refusal, not trimmed).
- `--base-branch` before or after the other flags works the same.
- The dry run (no `--apply`) never takes the flag.

## Requirements

### Functional requirements

- **FR-001**: `import-registry` MUST accept `--base-branch <name>` only together with `--apply --project <name>`. In any other combination it MUST print the usage and exit 2 before it reads or writes anything.
- **FR-002**: A missing value, a value that starts with `--`, and a repeated flag MUST be usage errors (exit 2).
- **FR-003**: A value that breaks the branch name rules in story 3 scenario 3 MUST exit 2 with a message naming the rule, before the registry file is read, and write nothing.
- **FR-004**: With a valid value, the apply MUST store it as the project's `baseBranch`, in the same single `putProjectConfig` call and transaction as the other fields.
- **FR-005**: The apply MUST be idempotent for `baseBranch`: an equal stored value is unchanged and not written.
- **FR-006**: Without the flag, the apply MUST leave `baseBranch` as stored and MUST print it as unchanged, as before this feature.
- **FR-007**: When the resulting mode is `local-only` and the resulting base branch is none, the output MUST say that merge and teardown refuse until the owner reruns the command with `--base-branch <name>`. This holds on a rerun that writes nothing.
- **FR-008**: The change MUST NOT add an event, an approval, a task change, a bb call that changes state, or a process, and MUST NOT make `workflow.json` able to set `baseBranch` (D-078).
- **FR-009**: The usage text, the server's command registration, `docs/CUTOVER.md`, `docs/LIVE-CHECK.md`, the supervisor skill, and `docs/DECISIONS.md` MUST describe the flag, with D-150 recording the decision.

### Key entities

- **Apply plan**: the existing plan, now with an optional requested base branch that joins the compared fields.
- **Stored project config**: the `project_config` row. The only thing the apply writes.

## Success criteria

### Measurable outcomes

- **SC-001**: After an apply with `--base-branch main` on a `local-only` line, a task in that project passes the base-branch check in both `worktreeReport` and the local merge preflight (zero "needs a base branch" refusals).
- **SC-002**: For every usage or validation refusal, a comparison of every store table before and after shows zero differences.
- **SC-003**: A second run of the same command shows zero differences and every field unchanged.
- **SC-004**: The existing apply and dry-run tests pass without edits.
- **SC-005**: A deliberate mutant that stores the flag without validation, writes `baseBranch` without the flag, or drops the `local-only` line fails at least one test.
- **SC-006**: `pnpm run check` passes with no lint error and no type error.

## Assumptions

- The owner knows the project's base branch and types it. The registry has no such field, and a file in the checkout is agent-writable (D-078), so the command line is the owner-only source.
- The command does not infer the base branch from the checkout, from `git`, or from bb, because an inferred value changes the landed-work check without the owner seeing it.
- The base branch also seeds dispatch for every mode, so storing it for a `direct-PR` or `no-mistakes` project is allowed and is the owner's choice.

## Out of scope

- The scout report file (finding 3) and every other test plan finding.
- Writing `defaultMachine` or the forge.
- Reading `baseBranch` from `workflow.json`, or inferring it.
- Checking that the branch exists.
- Applying all projects, or applying without `--project`.
