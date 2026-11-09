# Quickstart: validate agent-harness independence

This guide proves the feature end to end.
Part 1 runs in the repository with no bb and no credential.
Part 2 is the live check that the owner runs in the isolated lab (`docs/LIVE-CHECK.md`), because the fake host cannot prove bb's real answers.

## Part 1: the repository

Prerequisites: `pnpm install` has run.

| Step | Command | Expect |
| --- | --- | --- |
| Whole gate | `pnpm run check` | type check, lint, and every test pass |
| Contract table | `pnpm vitest run src/harness/contracts.test.ts` | every value of the four rows and the generic row is pinned |
| Readiness | `pnpm vitest run test/acceptance/harness-readiness.test.ts` | each non-`ready` state blocks with the remedy, zero tasks, zero spawns; a remote host uses its own states; the queue keeps the task |
| Admission | `pnpm vitest run test/acceptance/harness-admission.test.ts` | Pi is refused in `local-only` and allowed in `direct-PR` and `no-mistakes`, for each profile source and for the queue |
| No default | `pnpm vitest run test/acceptance/harness-default.test.ts` | the block text names `dispatch init`; the command writes a parseable file; the next dispatch resolves from the configured default |
| Models and ladders | `pnpm vitest run test/acceptance/harness-models.test.ts` | omp `off` passes, Codex `ultra` ranks, an unlisted level is refused, an unknown Pi model lists the choices |
| Failure causes | `pnpm vitest run test/acceptance/harness-failure.test.ts` | the four causes appear verbatim in the evidence and the wake text |
| Configure and hint | `pnpm vitest run test/acceptance/harness-configure.test.ts` | with the hint off the answer equals the old one; with it on, only workers on `mcp-deferred` and `xd-device` providers get it |
| Build | `pnpm run build` | `bb plugin build` passes (needs the `bb` CLI) |

## Part 2: the live check (the owner's step)

Run these in `bblab` with a bb 0.49.0 server.
No step needs a model or a credential.

1. `bb provider list --json` and the provider states route: confirm `providerStates` returns a record for each provider and for the tier 1 stub agent.
   If the stub is missing, record it (research, open point 1).
2. Dispatch to a provider whose CLI is signed out (Codex works): expect the `provider_unavailable` block with `codex login`, and no task in `factoryman_status`.
3. In a project with no `dispatch.json`, dispatch: expect the `no_default_profile` block.
   Run `bb factoryman dispatch init --provider <id>`, read the file, and dispatch again: expect `from the configured default`.
4. In a `local-only` project, run `dispatch init --provider pi` and dispatch: expect the admission block.
5. Dispatch a profile with a model that bb does not list for Pi: expect the list of choices, or "bb lists no models" with the load error.
6. Fail a worker on purpose (a signed-out Claude Code works): expect the task's evidence to hold "Not logged in" and the remedy line.
7. Confirm which model field a spawn resolves (`id` or `model`) from step 5's list, and record it in `spike/RESULTS.md`.

A step that disagrees with the fake host's behavior is a finding for `docs/DECISIONS.md`.
