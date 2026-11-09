# Quickstart: validate the conformance follow-up

## Prerequisites

1. `pnpm install --frozen-lockfile`.
2. `bwrap` is installed.
3. The four harness CLIs are installed (Claude Code, Codex, Pi, omp).
4. No credential is needed or used.

## Check the unit and acceptance tests

```sh
pnpm run check
```

Expect a pass, and expect the count of `bb-fake-plugin-host-*` directories in the temporary directory not to grow:

```sh
before=$(find "${TMPDIR:-/tmp}" -maxdepth 1 -name 'bb-fake-plugin-host-*' | wc -l)
pnpm run test
after=$(find "${TMPDIR:-/tmp}" -maxdepth 1 -name 'bb-fake-plugin-host-*' | wc -l)
echo "before=$before after=$after"
```

## Run the conformance suite

Run these one after another.
Use a lab directory outside `/tmp` and outside any path with `firstmate`.

```sh
pnpm run conformance -- --tier 1 --lab-dir /var/tmp/bblab-conformance-followup
pnpm run conformance -- --tier 1.5 --harness claude-code --lab-dir /var/tmp/bblab-conformance-followup
pnpm run conformance -- --tier 1.5 --harness codex --lab-dir /var/tmp/bblab-conformance-followup
pnpm run conformance -- --tier 1.5 --harness pi --lab-dir /var/tmp/bblab-conformance-followup
pnpm run conformance -- --tier 1.5 --harness omp --lab-dir /var/tmp/bblab-conformance-followup
pnpm run conformance:docs
```

Expect each command to exit 0.
Expect S9 to be the only known gap and S10 the only skipped scenario (tier 1.5).
Expect Pi's S4 to carry the `direct-PR` note in `docs/HARNESS-SUPPORT.md`.

## Check the decision log

```sh
grep -oE '^### D-[0-9]+' docs/DECISIONS.md | sort | uniq -d
```

Expect no output.
