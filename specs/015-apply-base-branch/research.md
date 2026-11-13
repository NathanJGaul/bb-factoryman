# Research: Apply a base branch

## Decision 1: An explicit `--base-branch <name>` flag on the apply

- **Decision**: The owner types the base branch on `import-registry --apply --project <name> --base-branch <name>`.
- **Rationale**: D-078 bars `workflow.json` from setting `baseBranch`, because an agent-writable file could name the task's own branch and make unlanded work look landed.
  The command line is the owner's.
  D-148 left the field "as stored" because the registry has none, and said nothing against writing it from a flag, so the flag extends D-148 and contradicts neither D-037 nor D-078.
- **Alternatives considered**:
  - Infer the base branch from the checkout's `HEAD` or the bb project default. Rejected: it changes the landed-work check without the owner seeing the value, and the apply runs no process.
  - A new registry token. Rejected: the registry is firstmate's file and has no such field. Extending its grammar is a firstmate change.
  - Only document the limit in `docs/CUTOVER.md`. Rejected: it leaves the owner to write SQL.
  - Read it from `workflow.json`. Rejected by D-078.

## Decision 2: A pure branch name check, no process

- **Decision**: `checkBranchName(value)` returns a reason string or null. The rules are the `git check-ref-format` rules that matter for a branch name: not blank, no leading `-`, no whitespace or control character, none of `~ ^ : ? * [ \`, no `..`, no `@{`, no `//`, no leading `/`, no trailing `/`, `.`, or `.lock`, and not the single character `@`.
- **Rationale**: A leading `-` would become a `git` option in `rev-list` and `merge`. Checking here fails early with a clear message. Running `git check-ref-format` would add a process to a command that runs none (D-148).
- **Alternatives considered**: Check that the branch exists. Rejected: needs a checkout and a process. Merge and teardown read the real checkout later and refuse.

## Decision 3: Show the gap on every outcome

- **Decision**: When the resulting mode is `local-only` and the resulting base branch is none, `applyReport` adds a line that names the consequence and the fix, even when nothing was written.
- **Rationale**: The owner reruns the command to check it (spec story 2), and the gap exists on a rerun too.
- **Alternatives considered**: Warn only on the first write. Rejected: a rerun would hide the gap.

## Decision 4: Allow the flag for every mode

- **Decision**: The flag is valid for any mode.
- **Rationale**: The store has one base branch per project, and dispatch starts worktrees from it for every mode. Refusing it for `direct-PR` would be an arbitrary limit.
