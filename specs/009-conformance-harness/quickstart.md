# Quickstart: Conformance harness

Run these commands from a clean checkout.
The commands that start a lab need `bwrap`, a pinned bb, and the harness command-line tools on the `PATH`.
No command here needs a credential.

## Prerequisites

1. Install the dependencies: `pnpm install --frozen-lockfile`.
2. Pick a lab directory outside `/tmp` and outside any path that contains `firstmate`, for example `/var/tmp/bblab-conformance`.
3. The runner installs the pinned bb (`bb-app@0.49.0`) into `<lab>/pin` the first time, with a redirected home.

## Run the tiers

```sh
pnpm run conformance -- --tier 1 --lab-dir /var/tmp/bblab-conformance
pnpm run conformance -- --tier 1.5 --harness pi --lab-dir /var/tmp/bblab-conformance
pnpm run conformance -- --tier 1.5 --harness claude-code --lab-dir /var/tmp/bblab-conformance
pnpm run conformance -- --tier 1.5 --harness codex --lab-dir /var/tmp/bblab-conformance
pnpm run conformance -- --tier 1.5 --harness omp --lab-dir /var/tmp/bblab-conformance
pnpm run conformance:docs
```

Each run prints one verdict per scenario and writes `conformance/results/<tier>-<harness>.json`.
The exit code is 0 when no scenario failed and no known gap has started to pass.

## Read a verdict

| Verdict | Meaning |
| --- | --- |
| `pass` | Every check passed. |
| `known-gap` | Only checks that `conformance/known-gaps.json` lists failed. The output names the report task that closes the gap. |
| `fail` | A check that is not a known gap failed. |
| `skipped` | The scenario does not run at this tier. |

## Add a harness

1. Write `tools/conformance/drivers/<id>.ts` with the driver interface.
2. Register it in `tools/conformance/drivers/index.ts`.
3. Run `pnpm run conformance -- --tier 1.5 --harness <id>` and `pnpm run conformance:docs`.
