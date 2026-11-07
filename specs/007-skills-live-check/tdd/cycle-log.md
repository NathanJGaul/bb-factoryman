# Cycle log: Skills and live check

Append only.
Newest last.
Every entry's `red` block is the evidence that the test existed and failed before the implementation.
The group commits its tests with stubs first, so git history shows the order.

## Baseline

- suite: `pnpm test` -> 90 files, 1107 passed, 0 failed
- commit: `0d114bd`

## Group 1: skills, selection, and the runbook

Red commit: `test: add skill and live-check tests with a selection stub (red)`. It holds the tests, a `skillsForMetadata` stub that returns no skill, the layout rule that now expects `skills/`, and spike item 11.

- red: `pnpm vitest run test/acceptance/skills.test.ts test/acceptance/live-check.test.ts src/tools/prompt.test.ts src/tools/register.test.ts test/acceptance/layout.test.ts` -> 15 failed
  - `[U1101]`, `[A1102]`: `expected [] to deeply equal [ 'factoryman-supervisor' ]`
  - `[A1101]`, `[A1103]`, `[A1104]`, `[A1105]`: `ENOENT` on `skills/`, because the skills do not exist yet; `[U208]`: `skills should exist`
  - `[A1106]`: `expected 'You are the worker for ship task k1. ...' to match /factoryman-worker skill/`
  - `[A1107]` to `[A1109]`, `[A1111]` to `[A1114]`: `ENOENT` on `docs/LIVE-CHECK.md`
- Passed against the stub: the 14 other tests in the five files.
- green: the two skills, `skillsForMetadata` and its use in `configure`, the worker prompt line, `docs/LIVE-CHECK.md`, and `test/fixtures/skills.ts`.
  - One surprise: the fake host rejects a selected skill that it does not know, and then returns no tools and no skills. Seven existing tests (`[U33]` to `[U39]`) failed until the fake host got the skill names. `test/fixtures/skills.ts` reads them from the skill files, so a rename that misses one place fails. D-090 and spike item 11 record it.
  - `[A1113]` first checked that the first `bblab down` came before the first `BBLAB_PASS_ENV`, which the "Read this first" block satisfies by itself. It now checks the order inside section 7: `bblab down`, then `read -rs`, then `bblab up`.
  - `pnpm run build` passes with `skills/` in the tree. A path install into a throwaway bb 0.48.1 listed both skills with scope `plugin` and ran the plugin's `protection` and `import-registry` commands.
  - `pnpm run check` -> 92 files, 1121 passed, 0 failed. Type check and lint clean.
