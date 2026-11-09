# Data model: Conformance follow-up

The feature adds one field and changes no stored schema.

## Driver (changed)

| Field | Type | Rule |
| --- | --- | --- |
| `deliveryMode` | `"local-only" \| "direct-PR" \| "no-mistakes"`, optional | The delivery mode of the lab project that the runner creates for this driver. Absent means `local-only`. The Pi driver sets `direct-PR`. |

The type is the same union as `DeliveryModeId` in `src/harness/contracts.ts`.
The tools do not import `src/`, so the driver file declares its own copy of the union.

## Lab project (changed)

The `project_config` row that the runner writes has `delivery_mode` set from `driver.deliveryMode ?? "local-only"`.
Nothing else in the row changes.

## Check note (existing field, new use)

`Check.note` already exists (S7 for omp uses it).
S4 sets it on `S4.review-ready` when the driver's mode is not `local-only`.
The document generator already shows a note next to a passing scenario.

## Known gap (changed content)

`conformance/known-gaps.json` loses three entries and keeps three.

| Check | Harness | Task | Action |
| --- | --- | --- | --- |
| S1.unready-blocks | * | H1 | remove |
| S1.remedy | * | H1 | remove |
| S7.cause | * | H3 | remove |
| S9.start-command | * | H4 | keep |
| S9.stamp-advice | codex | H4 | keep |
| S9.stamp-advice | omp | H4 | keep |

## Test temporary directory (new)

For each test file, the setup file makes one directory `<tmpdir>/bb-factoryman-test-<random>` and sets `process.env.TMPDIR` to it.
After the file, it removes that directory and restores the old `TMPDIR`.
It owns nothing else.
