# Quickstart: validate the documents

## Prerequisites

1. The branch `fm/bb-factoryman-harness-docs`, and `pnpm install --frozen-lockfile`.

## Run

```sh
pnpm vitest run test/acceptance/live-check.test.ts test/acceptance/decision-log.test.ts
pnpm run check
git diff --stat -- src tools skills conformance docs/HARNESS-SUPPORT.md
```

## Expect

1. Both guard files pass.
2. `pnpm run check` exits 0.
3. The last command prints nothing: no code, skill, conformance file, or generated document changed.
4. `grep -n "stub agent does not exist" docs/LIVE-CHECK.md` prints nothing.
5. `grep -cP "\x{2014}" docs/LIVE-CHECK.md docs/DESIGN.md docs/DECISIONS.md` prints 0 for each file (no em dash).
