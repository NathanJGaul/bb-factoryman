# Research: Conformance follow-up

## What master holds today

- `docs/DECISIONS.md` holds D-001 to D-117 with unique headings.
  Pull request 6 added D-100 to D-107 first.
  Pull request 5 was rebased onto it and renumbered its entries to D-108 to D-116, and D-117 records that (see the last paragraph of D-117).
  Every `D-nnn` in a tracked file names a heading, and the citations of D-100 to D-107 in `specs/009-conformance-harness/` fit their entries.
- `conformance/known-gaps.json` still lists S1.unready-blocks, S1.remedy (task H1), and S7.cause (task H3).
  Pull request 5 closed both tasks, so the runner reports them as stale gaps and exits 1.
- `tools/conformance/real-lab.ts` writes the project row with the literal `local-only`.
- `src/harness/contracts.ts` refuses Pi in `local-only` with the reason that Pi has no sandbox.
- `src/machine/guards.ts` accepts `review_ready` in `direct-PR` only with a pull request URL, and in `local-only` only with landed commits.
- The omp driver profile asks for reasoning level `low`.
  `src/dispatch/availability.ts` compares a profile's level with the model's own list, and the list for the lab model is `off`, `auto`.
- `test/fixtures/plugin-host.ts` builds a fake host for each world and does not dispose it.
  The SDK makes the directory with `mkdtempSync(join(tmpdir(), "bb-fake-plugin-host-"))` and removes it only on `dispose`.
  Direct callers of `createFakePluginHost` also exist in `src/server.test.ts`, `src/tools/register.test.ts`, `src/bb/adapter.test.ts`, and `test/acceptance/plugin.test.ts`.
- This machine's `TMPDIR` is `/home/nathanjgaul/.cache/tmp`, not `/tmp`, for the tool sessions.
  Other lanes use `/tmp`.
  The fix must not hard-code a path.

## Decisions

| Question | Decision | Why | Alternatives |
| --- | --- | --- | --- |
| Where does the delivery mode live? | On the driver, default `local-only` | The contract refuses a mode per harness, so the harness owns the answer | A runner flag (lets a maintainer ask for a refused combination) |
| Which mode for Pi? | `direct-PR` | Needs only a pull request URL, no validator | `no-mistakes` (needs a validator run the lab lacks) |
| What does S4 do for Pi? | Runs in `direct-PR` and checks the same three facts | The refusal is proven elsewhere; the point of S4 is the ship path | Assert Pi's refusal in S4 (S4 would then not exercise a Pi ship task) |
| Which omp level? | `auto` | Listed by the model; bb's default | `off` (also valid) |
| Renumber the decision log? | No, add a guard | Master is already unique and consistent | Renumber again (would break the citations that are right) |
| How to stop the leak? | A setup file with a per-file `TMPDIR` | Covers every caller with one hook | Per-world registry (misses direct callers); module mock (hides the SDK) |
| How to prove the leak fix? | A child `vitest` run with a private `TMPDIR` | The cleanup runs after the file, so only a second process can see it | An in-file check (cannot see the cleanup) |

## Open items for the live runs

- Whether a `direct-PR` Pi worker passes S5, S6, S8, S11, and S12 as well as it passed in the report's scout runs.
- Whether omp's S2 unsupported profile is refused for the permission mode after the level change.
- The wall-clock time of five sequential runs.
