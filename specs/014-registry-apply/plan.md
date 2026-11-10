# Implementation plan: Registry apply

**Branch**: `fm/bb-factoryman-registry-apply` | **Date**: 2026-11-10 | **Spec**: [spec.md](spec.md)

## Summary

`bb factoryman import-registry` previews the move from firstmate and refuses `--apply` (D-088).
The captain asked for the apply path.
This plan adds `--apply --project <name>`, which copies one registry line's delivery mode, `yolo` flag, and branch prefix into the stored config of the one bb project with that name.

The plan has three parts.

1. **A pure apply plan.**
   `src/limits/registry-apply.ts` takes one registry entry, the matching bb projects, and the stored config.
   It returns a refusal or a plan that lists each field with its old value, its new value, and whether it changes.
   It has no store, no bb, and no file access.
2. **The command glue.**
   `importRegistry` in `src/tools/supervisor-command.ts` parses the new flags, reads the file, lists the bb projects, calls the plan, and writes through `store.transaction` with `putProjectConfig` only when a field changes.
   The dry run path does not change.
3. **Docs and help.**
   D-148 in `docs/DECISIONS.md`, with pointers from D-078 and D-088.
   `docs/CUTOVER.md`, `docs/LIVE-CHECK.md`, the supervisor skill, the usage text, and the server's command registration.

No state machine change, no store interface change, no new dependency, and no new tool.

## Technical context

- Language and tooling: TypeScript 6 (binary `tsc6`), ESM, Node 26, `pnpm` 12, `vitest` 5.
- Files that change or appear in `src/`:
  - `src/limits/registry-apply.ts` (new, no bb import): `planApply`.
  - `src/limits/registry-apply.test.ts` (new).
  - `src/tools/supervisor-command.ts`: flag parsing, the apply flow, the usage text.
  - `src/tools/supervisor-command.test.ts`: the two `--apply` refusal tests are replaced.
  - `src/server.ts`: the command registration text.
- Files outside `src/`:
  - `test/acceptance/limits-cutover.test.ts` (`[A1023]` is replaced; new apply acceptance tests go in `test/acceptance/registry-apply.test.ts`).
  - `test/acceptance/live-check.test.ts` (the expected flag list of `import-registry`).
  - `docs/CUTOVER.md`, `docs/LIVE-CHECK.md`, `docs/DECISIONS.md`, `skills/factoryman-supervisor/SKILL.md`.
- Facts used:
  - `parseRegistry` returns `RegistryEntry` values with `mode`, `yolo`, `branchPrefix`, `flags`, and `notes`. A bare `yolo` token is a leftover token, so it is the registered mode or an unexpected token, and the entry carries a flag.
  - `Store.getProjectConfig` returns the default config for a project with no row. `Store.putProjectConfig` upserts. `Store.transaction` rolls back on a throw.
  - The CLI runs with `rt.deps.store`, `rt.deps.files`, and `rt.deps.bb.listProjects`. None of them changes bb state.
  - `effectiveProject` treats a null stored `branchPrefix` as "fill from `workflow.json`" (D-078).
  - A task copies its mode at creation, so an applied mode change reaches only tasks created later.
- Constraints: no write to the registry file, no process, no event, no approval, no task change, offline tests only.
- Scale: one pure module, one command change, one acceptance file, one decision.

## Constitution check

| Principle | How the plan complies |
| --- | --- |
| I. Gates live in code and fail closed | The apply refuses on any flag, any ambiguity, any unknown project, and any list failure. It never turns `yolo` on from a bare token. It writes the owner's registry value of `yolo`, which D-148 records as the one path that the registry (and so the owner) sets it. The merge gate is untouched. |
| II. Machine core is pure | No change to `src/machine/`. |
| III. Event log is the source of truth | The apply writes the config cache only and no event. Config is not derived from events (D-037), so this is not a cache bypass. D-148 records that no event is written. |
| IV. Storage behind an interface | The apply uses `getProjectConfig`, `putProjectConfig`, and `transaction`. No store change. |
| V. Test first | Every behavior in `tdd/test-list.md` gets a failing test first, recorded in `tdd/cycle-log.md`. |
| VI. Scope | The captain asked for the apply path. Task import, a cancel-queued-task tool, tool hints, and real-model runs stay out. The live install into the owner's bb stays the owner's step. |
| Engineering constraints | No other bb plugin is called. `src/machine/` has no bb import. No dependency is added. Docs follow the Google developer documentation style, one sentence per line. |

Result: no violation, so no complexity tracking.
The post-design check found no new issue.

## Decisions

D-148 lands in `docs/DECISIONS.md`.
`research.md` gives the choices with their alternatives.

1. Apply is explicit, one project, flag-free lines only.
2. The registry value replaces the stored value (including `yolo` off), and a bare `yolo` never turns it on.
3. `baseBranch` and `defaultMachine` stay as stored. Forge is printed and not stored.
4. A blank prefix is stored as null.
5. No event, no approval, no task change.
6. Idempotent: write only when a field differs.
7. A mode change does not reach tasks that already exist.

## Project structure

```text
specs/014-registry-apply/
  spec.md  plan.md  research.md  data-model.md  quickstart.md  tasks.md
  contracts/cli.md
  tdd/  checklists/
src/limits/registry-apply.ts (+ test)
src/tools/supervisor-command.ts (+ test)
test/acceptance/registry-apply.test.ts
```
