# Quickstart: validate tools, event wiring, and the validator

These steps prove each user story from a clean checkout.
Contracts: [tools](contracts/tools.md), [events](contracts/events.md), [validator](contracts/validator.md).

## Prerequisites

- Node 26 and `pnpm` 12.
- `pnpm install`.
- `git` on the path.
  The git tests build temporary repositories and need no network.
- Optional, for the build check: `bb` 0.48.1 on the path.

## Run the whole suite

```sh
pnpm run check
```

Expected: type-check, lint, and all tests pass with no skipped test.

## Story 1: tools and approval

```sh
pnpm vitest run test/acceptance/tools-visibility.test.ts
pnpm vitest run test/acceptance/tools-dispatch.test.ts
pnpm vitest run test/acceptance/tools-merge.test.ts
pnpm vitest run test/acceptance/tools-teardown.test.ts
```

Expected: the merge tests show one merge execution after a submitted approval, and none after a denial, a cancelled form, a timed-out form, or an unreadable answer.

## Story 2: event wiring

```sh
pnpm vitest run test/acceptance/wiring-events.test.ts
pnpm vitest run test/acceptance/wiring-recorded.test.ts
pnpm vitest run test/acceptance/wiring-startup.test.ts
```

Expected: the replayed sequence in `wiring-events` produces exactly the listed messages.
The recorded test feeds the real bb payloads from `test/fixtures/recorded/bb-0.48.1/`.

## Story 3: validator

```sh
pnpm vitest run test/acceptance/validator-fake.test.ts
pnpm vitest run test/acceptance/validator-recorded.test.ts
```

Expected: a task goes from handoff to review ready with the fake validator and with the recorded no-mistakes output, and a gate pauses it in `needs_decision`.

## Build check

```sh
pnpm run build
```

Expected: `dist/server.js` is written and `dist/server.meta.json` names bb 0.48.1 and SDK 0.6.104.

## Repeat the spike

See the Method section of `spike/RESULTS.md` to run the real bb and no-mistakes checks again.
The live install into the owner's bb is the owner's step (milestone 11).
