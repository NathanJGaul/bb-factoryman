# Decisions

This file records every deviation from `docs/DESIGN.md`, every gap the design leaves open, and every choice that the design does not settle.
Each entry names the reason.
The design stays authoritative until the owner changes it.

## Status key

- **Deviation**: the code differs from the design text.
- **Gap**: the design is silent, so the code picked a behavior.
- **Limit**: something could not be verified in the build environment.
- **Open**: the owner needs to decide.

## Milestone 1: scaffold

### D-001: `bb plugin build` cannot run here (Limit)

The `bb` command-line tool is not installed in the build environment, and no `@get-bb/cli` package exists on npm.
The `build` script is `bb plugin build`, and a test pins that script.
Type-check, lint, and the fake plugin host verify the plugin instead.
**Open**: run `pnpm run build` on a machine with bb installed and report the result.

### D-002: Manifest has no `bb.skills` key (Gap)

The design lists `bb.server` and `bb.skills` in the manifest.
The public example plugins in `get-bb/bb` declare `bb.server` only and call `skills/` "the conventional plugin skills directory".
Skills arrive in milestone 11, so the scaffold declares no skills key and no `skills/` directory.
Revisit when milestone 0 settles how bb finds skills.

### D-003: TypeScript 6 through an alias (Gap)

`typescript-eslint` rejects TypeScript 7.0, which is the current `typescript` release.
The `typescript` dev dependency is therefore `npm:@typescript/typescript6@^6.0.2`, the same alias the bb repository uses.
Switch back when `typescript-eslint` supports TypeScript 7.

### D-004: Toolchain choices (Gap)

The design names `vitest`, `zod`, `xstate`, and `better-sqlite3` and leaves the rest open.
The scaffold uses `pnpm` 12 (the bb repository's package manager), `eslint` 10, and `vitest` 5.
`@get-bb/plugin-sdk` is pinned to the exact version 0.6.125.
`hono` and `cron-parser` are dev dependencies because the SDK's fake host needs them as optional peers.
`pnpm-workspace.yaml` approves the `better-sqlite3` and `esbuild` build scripts and exempts the SDK from pnpm's release-age policy, because 0.6.125 was published on the day of the scaffold.

### D-005: The lint rule is stricter than the design (Deviation)

`CLAUDE.md` asks for a `no-restricted-imports` rule for `@get-bb/*` in `src/machine/`.
The rule also bans `better-sqlite3`, Node built-ins, imports from `src/store`, and every dynamic `import()` in that directory.
The machine performs no input or output (FR-012), and ESLint's `no-restricted-imports` does not see `import()`.
The stricter rule only tightens the isolation promise.

### D-006: The plugin's identity is one log line (Gap)

The scaffold milestone asks that the empty plugin loads in the fake host.
The plugin factory logs `bb-factoryman loaded` and registers nothing else.
The log line gives the load test a real assertion to fail first.

### D-007: Spec-Kit sequencing and approvals (Gap)

`/speckit.tdd.plan` needs `.specify/memory/tdd-profile.md`, which `/speckit.tdd.setup` writes after the test stack exists.
The order was therefore specify, plan, tasks, toolchain files, `tdd.setup`, then `tdd.plan`.
The toolchain files hold configuration and one smoke test, and no feature code.
The captain's intent fixed the scope, so the specification, plan, and task list were approved by that intent and not by a separate review.
The constitution's test-first principle uses the exact wording of the Spec-Kit workflow.
**Open**: the owner may confirm or reword principle V in `.specify/memory/constitution.md`.
