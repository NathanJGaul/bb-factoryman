# Implementation plan: Apply a base branch

**Branch**: `fm/bb-factoryman-base-branch-gap` | **Date**: 2026-11-12 | **Spec**: [spec.md](spec.md)

## Summary

After `import-registry --apply --project <name>`, a `local-only` project has no base branch, so merge and teardown refuse (finding 1 of the manual test plan).
This plan adds an explicit `--base-branch <name>` option to the apply.
The option stores the owner's value as the project's `baseBranch`.
Without the option nothing changes, and the output says when a `local-only` project still lacks a base branch.

The plan has three parts.

1. **Pure logic.**
   `src/limits/registry-apply.ts` gains `checkBranchName`, which returns a reason or null, and an optional `baseBranch` input to `planApply`.
   A given value joins the compared fields (`FieldChange`), so it is written only when it differs.
   The plan also returns `needsBaseBranch`, true when the resulting mode is `local-only` and the resulting base branch is none.
2. **Command glue.**
   `parseImportArgs` in `src/tools/supervisor-command.ts` accepts `--base-branch` with `--apply` only, and validates the value before it reads the file.
   `applyReport` prints the field and the `local-only` hint.
   The write path (one `putProjectConfig` in one transaction) does not change.
3. **Docs and help.**
   D-150 in `docs/DECISIONS.md` with pointers from D-037, D-078, and D-148.
   `docs/CUTOVER.md`, `docs/LIVE-CHECK.md`, the supervisor skill, the usage text, and the server's command registration.

No state machine change, no store change, no new dependency, no new tool, and no `workflow.json` change.

## Technical context

- Language and tooling: TypeScript 6 (`tsc6`), ESM, Node 26, `pnpm`, `vitest`.
- Files that change:
  - `src/limits/registry-apply.ts` and `.test.ts`.
  - `src/tools/supervisor-command.ts` and `.test.ts`.
  - `src/server.ts` (the usage text of the command registration).
  - `test/acceptance/live-check.test.ts` (the flag list of `import-registry`).
  - `test/acceptance/registry-apply-base-branch.test.ts` (new): real entry point `runFactorymanCommand` through the plugin factory, then merge preflight and `worktreeReport` against the stored config.
  - `docs/CUTOVER.md`, `docs/LIVE-CHECK.md`, `docs/DECISIONS.md`, `skills/factoryman-supervisor/SKILL.md`.
- Facts used:
  - `worktreeReport` (`src/git/report.ts`) and the local merge preflight (`src/git/merge.ts`) refuse a null, blank, or `-`-prefixed base branch. They are the consumers.
  - `Store.putProjectConfig` upserts and `Store.transaction` rolls back on a throw.
  - The existing apply compares each field with the stored value and writes only when one differs (D-148).
  - The CLI runs no process, so it cannot check that the branch exists.
- Constraints: no event, no approval, no task change, no process, offline tests only.

## Constitution check

| Principle | How the plan complies |
| --- | --- |
| I. Gates live in code and fail closed | The new value is owner-typed and validated in code. The landed-work check and merge preflight are untouched, and a wrong name still refuses later. No agent-writable file can set it (D-078). |
| II. Machine core is pure | No change to `src/machine/`. |
| III. Event log is the source of truth | The apply writes the config cache only, as D-148 recorded. |
| IV. Storage behind an interface | Uses `getProjectConfig`, `putProjectConfig`, and `transaction`. |
| V. Test first | Each behavior in `tdd/test-list.md` gets a failing test first, recorded in `tdd/cycle-log.md`. |
| VI. Scope | The captain approved the fix on 2026-11-12. Out of scope items stay out. |
| Engineering constraints | No other plugin is called, no dependency added, docs follow the style guide. |

Result: no violation. The post-design check found no new issue.

## Decisions

D-150 lands in `docs/DECISIONS.md`. `research.md` gives the alternatives.

1. An explicit flag, not inference and not a registry or `workflow.json` field.
2. A pure branch name check with no process.
3. A hint line for `local-only` with no base branch, on every apply outcome.
