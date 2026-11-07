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

## Cycle R1: audit remediation (structure tests, two skill fixes, runbook steps)

The cold audit (`tdd/verification.md`, commit `7bbd5c9`) returned FAIL: 140 mutants, 75 survived, 74 of them real.
The tests for the skills and the runbook checked that sentences were present, and none could see a sentence that contradicted a rule.
Two findings were product defects and not test gaps, and the runbook had three steps that a reader could not follow.
The tests now read the files as structure: sections, tables, fenced blocks, and the schemas, states, and tables in the code (`test/fixtures/markdown.ts`, `test/fixtures/skill-lint.ts`, `test/fixtures/bb-cli.json`).
Mutants below use the audit's IDs. Each was applied by hand, run against the five test files, and restored. A second helper, `scratchpad/m11mut.py`, ran 86 of them: 85 died at once and S17 survived until the lint dropped a word that excused it.

- R1 `[A1114]`, `[A1111]`, `[A1124]`: the shell blocks may name the token on four fixed lines only, no line carries a redirect, a pipe, or a substitution, `BBLAB_PASS_ENV` lists exactly the two variables, the run starts in a fresh `env -i` shell, and it ends with `unset`, `exit`, and a revoke.
  Mutants: read from a file (C02), on a command line (C03), written to a file (C04), pasted to the supervisor (C05), widened `BBLAB_PASS_ENV` (C06), the supervisor runs `setup-token` (C08), no revoke (C10), a quoted literal (C12), no fresh shell (C14), no `unset` (C15) -> each failed.
- R2 `[A1115]`, `[U1102]`: a lint fails on a sentence that tells an agent to set `yolo`, retry weaker, approve for the owner, force a removal, push to `origin`, skip a check, call a merge done early, or (worker) contact the owner, unless the sentence forbids it. `[U1102]` runs the lint on good and bad sentences. `[A1105]` anchors the push rule to the `no-mistakes` row.
  Mutants: S14, S15, S16, S17, S26, W13b, W14, W15, W19 -> each failed.
- R3 `[A1107]`: every `bb` command in a shell block runs behind `bblab x`, no command names `~/.bb`, the install line names a path under `$BBLAB_DIR`, and every `no-mistakes daemon` call is `status`.
  Mutants: R03 (daemon stop), R04 (install without `bblab x`), R04b (install to `~/.bb`) -> failed.
- R4 `[A1112]`, `[A1113]`: the caps table, the `workflow.json` block (parsed by `parseWorkflowConfig`), the spawn command, the watchdog line, and the four gate conditions are pinned item by item. `[A1113]` also pins the stub-agent sentences.
  Mutants: G04 to G09, K05 to K23 (rows, `maxWorkers` 4, `maxTasksPerDay` 9, `--reasoning-level high`, an Opus model, "30 hours", no `&`, `no-mistakes` mode, `yolo` 1) -> each failed.
- R5 `[A1121]`: a real dispatch through the fake host spawns a worker whose prompt holds the skill line, the branch, and the description. Mutant: `launch.ts` builds its own prompt (M18) -> failed.
- R6 product fix: the supervisor skill now says that `factoryman_merge` takes a ship task in `review_ready` or `awaiting_approval`, that no answer or a denial leaves it in `awaiting_approval` and the supervisor asks again, and that `factoryman_teardown` also takes a scout in `report_ready`. `MERGEABLE_STATES` is exported from `merge.ts` and drives the tool and the test. `[A1118]` pins the three sentences against the code and `TABLES`.
  Mutants: merge in one state only (S19), merge in any state (S19b), the `yolo` clause removed (S20), no scout teardown (S21), no second ask (S28) -> each failed.
- R7 `[A1116]`, `[A1117]`, `[A1119]`: every backticked name must be defined in the code (tools, schema fields, outcomes, states, kinds, modes), the wake table equals `WAKE_STATES`, and the worker's outcome sentence equals the schema's outcomes.
  Mutants: wrong dispatch arguments (S22), wrong `states` argument (S23), a wake row removed (S24) or renamed (S25), `prURL` (W16), `landed` (W17), `stuck` and `abandoned` (W18) -> each failed.
- R8 `[A1108]`: all eleven headings, the six tier 0 rows, the seven hard-rule checks, the eight gaps, the three teardown commands, and the funding line are pinned.
  Mutants: H01, H02, H04, H06, H08, U01, U02, U04 to U08, U11 -> each failed.
- R9 `[A1109]`: the flags of each `bb factoryman` call are checked against the command, the machine is `server`, and every other `bb` command and flag must exist in `test/fixtures/bb-cli.json`, which I recorded from `bb <command> --help` of bb 0.48.1. The runbook said `lab-box`, which does not exist in the lab: the report names the lab's one machine `server`. That was a real defect.
  Mutants: a flag typo (X02), `lab-box` (X04), a mistyped core command (X08b), a wrong flag (X09), `bb thread send` (X12) -> each failed.
- R10 `[A1122]`: the runbook now has the script that writes the `local-only` row with `yolo` 0 (I ran the same statement against a throwaway plugin database), and it drives the supervisor with `bb thread tell` after the stamp, because the stamp applies from the next session.
  Mutants: `no-mistakes` mode (K22), `yolo` 1 (K23), "the stamp applies at once" (X11) -> failed.
- R11 `[A1114]`: the order inside section 7 is `bblab down`, the fresh shell, `read -rs`, then `bblab up`, as positions in the command list. Mutant: drop the first `bblab down` (C13) -> failed.
- R12 `[U1103]`: roles `Supervisor`, `WORKER`, padded, arrays, `null`, `undefined`, an object, `true`, and `0` select nothing, for the skills and the tools.
  Mutants: `String(role)` (M09), trimmed and lowercased (M11) -> failed.
- R13 `[A1123]`: the prerequisites read the Claude usage, and the teardown section compares it with the caps. Mutants Q01, Q02 -> failed.
- R14: the runbook says what can read the token (section 7), starts tier 2 in a fresh `env -i` shell, and lists the keeper-environment question as untested in section 9 (`bblab` is not installed here, so I could not test it). The description bounds in `[A1101]` are named, `test-list.md` is refreshed, and the "first six" sentence is gone.
- suite: `pnpm run check` -> 92 files, 1133 passed, 0 failed. Type check and lint clean.
