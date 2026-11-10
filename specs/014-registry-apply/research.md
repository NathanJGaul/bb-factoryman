# Research: Registry apply

No unknowns remain from the technical context.
These are the choices and what was weighed.

## R1: Where the plan logic lives

- **Decision**: A pure function in `src/limits/registry-apply.ts`, next to `parseRegistry`.
- **Rationale**: Table-driven tests can cover every refusal without a store, a file, or bb. The command only reads and writes.
- **Alternatives**: Put it inside `importRegistry` (harder to test, and the function is already long). Put it in `src/store/` (the store should not know the registry format).

## R2: Which fields to write

- **Decision**: `deliveryMode`, `yolo`, and `branchPrefix`. Leave `baseBranch` and `defaultMachine` as stored. Print the forge and do not store it.
- **Rationale**: These are the three values the dry run reports that the config has a field for. The registry has no base branch or machine. `baseBranch` decides the landed-work check at teardown (D-078), so a registry import must not set it.
- **Alternatives**: Store the forge (no field, and the design has no use for it). Also write a default base branch (a gate input, and nothing in the registry supports it).

## R3: What `yolo` does

- **Decision**: Copy the line's `+yolo` value in both directions. A bare `yolo` never reaches the plan, because its line is flagged.
- **Rationale**: The registry is the owner's setting in firstmate, so copying `+yolo` carries a grant the owner already made. Copying "off" over a stored "on" fails safe. A bare token is a typo for `+yolo` or an unknown mode, and guessing would grant a bypass (D-088).
- **Alternatives**: Never turn `yolo` on (blocks a project that the owner runs with `+yolo`, and the owner can then only set it by hand, which is the same grant with less record). Only ever turn it off (inconsistent with "the registry is the source").

## R4: Blank branch prefix

- **Decision**: An empty prefix (`branch=` with no value) is stored as null. A missing `branch=` token gives the registry default `fm/`, which the report already shows.
- **Rationale**: The stored field is `string | null`, and null means "unset", which is what a blank value means. An empty string would make a branch name start with nothing and still look set.
- **Alternatives**: Store an empty string (ambiguous with unset). Refuse the line (the dry run does not flag it).

## R5: Matching names

- **Decision**: Compare `--project` with the registry name, and the registry name with the bb project name, case-insensitively, as the dry run does. More than one match on either side is ambiguous and refused.
- **Rationale**: The dry run picks the first bb project that matches, which hides a duplicate. A write needs a stronger rule.
- **Alternatives**: Take the first match (could write the wrong project). Accept a bb project ID in `--project` (the brief says name).

## R6: Idempotence and writes

- **Decision**: Compare the target with the stored config field by field, and call `putProjectConfig` once inside `store.transaction` only if a field differs. The row written is the stored config with the three fields replaced.
- **Rationale**: A rerun writes nothing, and the other two fields cannot be disturbed. `getProjectConfig` returns the default for an absent row, so a project that already resolves to the target needs no row.
- **Alternatives**: Always write (not idempotent in effect, and it rewrites the row). Write a log event (the config has no event today, and the brief says nothing about one).

## R7: Flag parsing

- **Decision**: `--apply` and `--project <name>` join `--file`. `--project` without `--apply`, a repeated `--project`, `--apply` without `--project`, or `--project` without a value prints the usage and exits 2 before any read.
- **Rationale**: The dry run must stay exactly as it is, and a half-formed apply must not fall back to a dry run silently.
- **Alternatives**: Let `--project` filter the dry run (changes the dry run, which the brief says to keep).

## R8: Errors and exit codes

- **Decision**: Usage errors exit 2. Refusals (no such registry line, unknown or ambiguous project, flagged line, bb list failure, unreadable file, failed write) exit 1 and write nothing. A write and an idempotent no-op exit 0.
- **Rationale**: This matches the existing commands.
