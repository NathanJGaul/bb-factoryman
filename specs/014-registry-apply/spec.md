# Feature specification: Registry apply

**Feature branch**: `fm/bb-factoryman-registry-apply`

**Created**: 2026-11-10

**Status**: Approved (scope fixed by the captain's request "start the registry apply" and the Firstmate spec for this task)

**Input**: `bb factoryman import-registry --file <path>` is a dry run today.
It reads firstmate's project registry and prints each project's mode, `yolo`, branch prefix, and forge (D-088).
`--apply` is refused, because nothing writes the stored project config, and D-078 and D-088 left the apply path open for the owner.
The captain has now asked for the apply path, so that projects can move off firstmate one at a time, as `docs/CUTOVER.md` describes.
This feature builds it and records the decision as D-148.

## User scenarios and testing

The person who uses this feature is the owner, who runs the command in a terminal during a cutover.
There is no screen.
The real entry point is `runFactorymanCommand`, which `bb factoryman import-registry` calls, and the stored project config that the rest of the plugin reads.

### User story 1 - Copy one project's registry settings into its stored config (priority: P1)

The owner has previewed the registry and has read every flagged line.
The owner picks one project, finishes its firstmate tasks, and runs `bb factoryman import-registry --file <path> --apply --project <name>`.
The plugin finds the registry line and the bb project with that name, and writes the line's delivery mode, `yolo` flag, and branch prefix into that project's stored config.
It prints what it wrote and what it left unchanged.

**Why this priority**: Without it, a project stays in `no-mistakes` mode with `yolo` off until a person sets the config by hand, and a `direct-PR` or `local-only` project cannot move off firstmate.

**Independent test**: Load the plugin into the fake host with a bb project list and a registry file, run the command with `--apply --project`, and read the stored config back.

**Acceptance scenarios**:

1. **Given** a registry line `- gizmos [direct-PR branch=wip/] - ...` and a bb project named `gizmos` with the default stored config, **When** the owner runs the command with `--apply --project gizmos`, **Then** the stored config for that bb project holds `direct-PR`, `yolo` off, and `wip/`, and the output says what it wrote.
2. **Given** a registry line with `+yolo`, **When** the owner applies it, **Then** the stored `yolo` is on, and the output says so.
3. **Given** a registry line with a bare `yolo` token, **When** the owner applies it, **Then** nothing is written (the line is flagged), and `yolo` stays off.
4. **Given** a line `- prod gadgets [no-mistakes-prod-only] - ...`, **When** the owner applies it, **Then** the stored mode is `no-mistakes`, and the output prints the note that the policy is conditional in firstmate and maps to its most rigorous leg.
5. **Given** the stored config holds a base branch and a default machine, **When** the owner applies a line, **Then** both stay as stored, and the output lists them as unchanged.
6. **Given** a line with no bracket, **When** the owner applies it, **Then** the stored mode is `no-mistakes` and `yolo` is off.
7. **Given** a line with `branch=` and no value, **When** the owner applies it, **Then** the stored branch prefix is blank (null), as the report shows it.
8. **Given** the line has `forge=gerrit`, **When** the owner applies it, **Then** the write goes ahead, the output prints the forge note, and the output says the forge is not stored.

### User story 2 - A rerun changes nothing (priority: P1)

The owner runs the same command again, for example after a doubt about whether it worked.

**Why this priority**: A cutover step that the owner cannot safely repeat is a step the owner will not trust.

**Independent test**: Run the command twice and compare the stored config and the output.

**Acceptance scenarios**:

1. **Given** the stored config already equals what the line says, **When** the owner runs the command again, **Then** nothing is written, every field is listed as unchanged, and the exit code is 0.
2. **Given** the stored config differs in one field, **When** the owner runs the command, **Then** only the differing field changes, and the output lists that field as written (with the old and new value) and the others as unchanged.
3. **Given** a second run, **When** it ends, **Then** the stored config is byte-for-byte what the first run left.

### User story 3 - The command refuses before it writes (priority: P1)

The command fails closed.
It writes nothing when it cannot be sure which project the owner means or whether the line is safe to copy.

**Why this priority**: The stored config decides the delivery mode and the `yolo` bypass (hard rule 1), so a wrong write loosens a gate.

**Independent test**: Run the command in each wrong situation and compare the whole store before and after.

**Acceptance scenarios**:

1. **Given** `--apply` with no `--project`, **When** the command runs, **Then** it prints the usage, exits 2, reads nothing, and writes nothing. It never applies all projects.
2. **Given** `--project` with no `--apply`, **When** the command runs, **Then** it prints the usage, exits 2, reads nothing, and writes nothing.
3. **Given** a `--project` name that no registry line carries, **When** the command runs, **Then** it exits 1, says the registry has no such project, and writes nothing.
4. **Given** a registry line and no bb project of that name, **When** the command runs, **Then** it exits 1, says bb does not know the project, and writes nothing.
5. **Given** two bb projects whose names match the `--project` name (case-insensitive), or two registry lines with that name, **When** the command runs, **Then** it exits 1, says the name is ambiguous, and writes nothing.
6. **Given** a registry line with a flag (an unknown mode, an unexpected token, an unclosed bracket), **When** the command runs, **Then** it exits 1, prints the flags, and writes nothing.
7. **Given** bb cannot list its projects, **When** the command runs, **Then** it exits 1, says it could not check that bb knows the project, and writes nothing.
8. **Given** the registry file is missing or unreadable, **When** the command runs, **Then** it exits 1 with the same message as the dry run and writes nothing.
9. **Given** an unknown flag or a stray argument, **When** the command runs, **Then** it prints the usage, exits 2, and reads nothing.
10. **Given** the write itself fails, **When** the command runs, **Then** the stored config is unchanged, and the command exits 1 and says so.

### User story 4 - The dry run is the default and does not change (priority: P1)

Without `--apply`, the command behaves exactly as it does today.

**Why this priority**: The owner previews before applying, and the preview must stay trustworthy.

**Independent test**: The existing dry-run tests (`[A1019]` to `[A1022]`, `[U1030]`, `[U1065]`, `[U1066]`) keep passing, apart from the `--apply` refusal tests, which this feature replaces.

**Acceptance scenarios**:

1. **Given** no `--apply`, **When** the command runs, **Then** the report, its columns, its flags and notes, and its "Dry run: nothing was written." line are what they were before this feature, and nothing is written.
2. **Given** the command help, **When** the owner reads it (the usage text, the `--help` listing, and the server's command registration), **Then** it shows `--apply --project <name>` and says that apply writes one project.

### User story 5 - The apply never touches firstmate, tasks, or events (priority: P1)

The apply writes the stored project config of one project and nothing else.

**Why this priority**: Hard rules 1 and 8 and the cutover rule that a branch is never driven by both systems.
The event log is the source of truth for tasks, and the apply must not add to it or change a task.

**Independent test**: Compare every table of the store, and the registry file's bytes and modification time, before and after.

**Acceptance scenarios**:

1. **Given** a successful apply, **When** the stores are compared, **Then** only one row of `project_config` differs, and `task`, `task_event`, and `approval` are identical.
2. **Given** any run, **When** it ends, **Then** the registry file is byte-identical, and the command ran no process and called no bb method that changes bb state.
3. **Given** a project with tasks in flight, **When** the owner applies a line, **Then** those tasks keep the mode they were created with.

### User story 6 - The docs match the behavior (priority: P2)

**Acceptance scenarios**:

1. **Given** `docs/CUTOVER.md`, **When** it is read, **Then** step 1 or a new step shows the apply command, "What the import does not do" no longer says that the apply path is a follow-up, and the page still says that tasks, approvals, and history are not imported and that firstmate is not touched.
2. **Given** `docs/DECISIONS.md`, **When** it is read, **Then** D-148 records the decision, and D-078 and D-088 point to it.
3. **Given** `docs/LIVE-CHECK.md`, **When** it is read, **Then** the line that says `--apply` is refused is updated.
4. **Given** the supervisor skill, **When** it is read, **Then** its line about `import-registry` no longer says it changes nothing without saying how to apply.

### Edge cases

- The registry name and the bb project name are compared case-insensitively, as the dry run does. The `--project` name matches the registry name the same way.
- A registry line with leading or trailing space in the name is read as the dry run reads it.
- A registry file with many projects and `--project` naming one: the other lines are read for the ambiguity check and never applied.
- The stored config may be the default (no row yet). The apply writes a row only when the target differs from what a read returns.
- A stored `yolo` that is on, with a registry line that has no `+yolo`: the apply turns it off and says so. The owner chose the registry as the source.
- The bb project list holds the same project under two ids: ambiguous, refused.
- `--apply` given twice, or `--file` twice: the last `--file` wins as today. `--project` twice is a usage error.

## Requirements

### Functional requirements

- **FR-001**: `import-registry` MUST write only when `--apply` is present. Without it, behavior MUST be the dry run of D-088, unchanged.
- **FR-002**: With `--apply`, `--project <name>` MUST be required. Without it, or with `--project` and no `--apply`, the command MUST print the usage and exit 2 before it reads or writes anything.
- **FR-003**: The apply MUST write the stored config of exactly one bb project, the one whose name matches `--project`. No input MUST make it write more than one project.
- **FR-004**: The apply MUST refuse and write nothing when the registry has no line, or more than one line, for `--project`.
- **FR-005**: The apply MUST refuse and write nothing when bb lists no project, or more than one project, with that name, and when bb cannot list its projects.
- **FR-006**: The apply MUST refuse and write nothing when the line has any flag.
  The flags are the ones the dry run prints: an unknown mode, an unexpected token, and an unclosed bracket.
- **FR-007**: The apply MUST set the stored `deliveryMode` to the plugin mode of the line, the stored `yolo` to the line's `+yolo` value, and the stored `branchPrefix` to the line's prefix, with an empty prefix stored as null.
  A bare `yolo` token MUST never turn `yolo` on: such a line is flagged and so refused.
- **FR-008**: The apply MUST map `no-mistakes-prod-only` to `no-mistakes` and MUST print the line's notes.
- **FR-009**: The apply MUST leave `baseBranch` and `defaultMachine` as stored.
- **FR-010**: The apply MUST be idempotent: when the stored config already holds the target values, it MUST write nothing, and a second run MUST leave the store identical.
- **FR-011**: The apply MUST write through the store interface in one transaction, MUST NOT append an event or an approval, and MUST NOT change a task.
- **FR-012**: The apply MUST NOT write, move, or delete the registry file, MUST NOT run any process, and MUST NOT call a bb method that changes state.
- **FR-013**: The apply MUST print the project, its bb id, each field with its old and new value and whether it was written or left unchanged, the line's notes, and the exit code MUST be 0 on a write and on an idempotent no-op.
- **FR-014**: A failed write MUST leave the stored config unchanged and exit 1.
- **FR-015**: The command help (the usage text, the server's command registration, and the live-check expectations) MUST show the new flags.
- **FR-016**: `docs/CUTOVER.md`, `docs/LIVE-CHECK.md`, the supervisor skill, and `docs/DECISIONS.md` MUST describe the apply path, with D-148 recording the decision and D-078 and D-088 pointing to it.

### Key entities

- **Registry entry**: one parsed line of firstmate's registry (`RegistryEntry`). Read only.
- **Stored project config**: the `project_config` row for a bb project ID. The only thing the apply writes.
- **Apply plan**: the target values from the entry, compared with the stored values, field by field. A pure value that tests read without a store.

## Success criteria

### Measurable outcomes

- **SC-001**: For every refusal in story 3, a comparison of every store table before and after shows zero differences (counted over the whole refusal table).
- **SC-002**: After a successful apply, exactly one `project_config` row differs and the three other tables show zero differences.
- **SC-003**: A second run of the same command shows zero differences and prints every field as unchanged.
- **SC-004**: The dry-run tests that exist today pass without edits, except the two tests that assert the `--apply` refusal.
- **SC-005**: A deliberate mutant that writes without `--project`, writes a flagged line, turns `yolo` on from a bare token, or writes a second project fails at least one test.
- **SC-006**: `pnpm run check` passes with no lint error and no type error.

## Assumptions

- The registry is the source of truth for mode, `yolo`, and branch prefix at the cutover. A registry value replaces a stored value, including turning `yolo` off.
- A `+yolo` token in the registry is the owner's deliberate setting in firstmate, so copying it is not a new grant. A bare `yolo` is never copied (D-088).
- Forge is not part of the stored config, so the apply prints it and does not store it.
- The command is run by the owner on their own machine, so it needs no caller check, like `supervisor`, `preflight`, and `dispatch init`.
- A blank branch prefix is stored as null. The report shows an empty column for it, and `effectiveProject` already treats null as "fill from `workflow.json`" (D-078).
- The apply does not look at tasks. The doc says to finish firstmate's tasks first, and a plugin task keeps the mode it was created with.

## Out of scope

- Importing tasks, approvals, or history.
- A cancel-queued-task tool.
- Tool hints.
- Real-model runs.
- Applying all projects at once, or applying without `--project`.
- Writing `baseBranch`, `defaultMachine`, or the forge.
- Reading or changing firstmate's registry or tasks beyond reading the `--file`.
