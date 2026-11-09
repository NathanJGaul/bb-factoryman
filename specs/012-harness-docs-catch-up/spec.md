# Feature specification: Harness documentation catch-up

**Feature branch**: `fm/bb-factoryman-harness-docs`

**Created**: 2026-11-09

**Status**: Approved (scope fixed by the captain's intent and the Firstmate spec for this task, report task H9)

**Input**: Task H9 of the harness-independence report (`data/bb-factoryman-harness-independence/report.md` in the firstmate home, section 7).
The harness-independence work is merged: the readiness gate, model-aware checks, cause-bearing failure evidence, the harness contract table, the conformance harness (tiers 1 and 1.5 in the runner, tier 2 by hand), `supervisor start --profile`, the `roles` block, and the validator observation.
The docs still describe a Claude-only world.
The captain asked to continue development and shelved the real-model (tier 2) runs.
The task changes documents only.
It makes no change under `src/` or `tools/`.

## User scenarios and testing

The people who use this feature are the owner, who reads the design and decision log and who runs the live-check runbook, and the maintainer, who reads the docs to learn which harnesses work.
The feature has no screen.
Its real entry points are the documents themselves, the decision-log guard (`test/acceptance/decision-log.test.ts`), the runbook guard (`test/acceptance/live-check.test.ts`), and `pnpm run check`.

### User story 1 - Run the live check on any harness (priority: P1)

The owner opens `docs/LIVE-CHECK.md` and finds one runbook for tiers 0, 1, 1.5, and 2.
Tier 1 and tier 1.5 are one command each.
Tier 2 says which credential each harness needs and who creates it, and says plainly that no tier 2 run has been done yet.

**Why this priority**: The runbook is the owner's step (D-092) and is the document that is furthest behind.
It says that the stub agent does not exist, that tier 2 is Claude-only, and that the token is a Claude token.

**Independent test**: Read the runbook against the code and the conformance tool.
Every command, flag, tool name, and provider it names exists.

**Acceptance scenarios**:

1. **Given** the runbook, **When** the owner reads section 2, **Then** the four tiers are listed with what runs, which credential each needs, and its spend, and tier 2 is marked not yet run for every harness.
2. **Given** the runbook, **When** the owner wants tier 1 or tier 1.5, **Then** the runbook gives `pnpm run conformance -- --tier 1` and `pnpm run conformance -- --tier 1.5 --harness <id>`, and points to `docs/CONFORMANCE.md`.
3. **Given** the runbook, **When** the owner reaches tier 2, **Then** a table gives for Claude Code, Codex, Pi, and omp the credential, who creates it, and how it enters the lab, and the shell blocks put no credential on a command line or in a file.
4. **Given** the runbook, **When** it names a harness-specific fact (the Pi mode, the Codex clear step), **Then** the fact matches the contract table in `src/harness/contracts.ts`.

### User story 2 - Read the design and see harness independence (priority: P1)

The owner opens `docs/DESIGN.md` and finds the dispatch profiles section describing profiles, readiness, the contract table, the `roles` block, `supervisor start`, and the validator observation.

**Why this priority**: DESIGN.md is authoritative.
A reader who trusts it learns neither that readiness comes from bb's provider states nor that a supervisor has a profile.

**Independent test**: Compare each sentence of the new section with the code it names.

**Acceptance scenarios**:

1. **Given** the design, **When** the owner reads the dispatch profiles section, **Then** it states the resolution order, the readiness gate, the model and level checks, the worker admission rule, and that no harness is a silent default.
2. **Given** the design, **When** the owner looks for the supervisor, **Then** it finds `bb factoryman supervisor start`, the profile order (flag, then `roles.supervisor.profile`, never `default`), and the stamp command's clear advice.
3. **Given** the design, **When** the owner looks for the validator, **Then** it finds that the plugin observes the validator's agent and never writes it, and that the hand-off never refuses on it while the preflight does.

### User story 3 - Trace every decision (priority: P2)

The owner opens `docs/DECISIONS.md` and finds the harness-independence decisions, the amendments to D-063 and D-064, and an entry for this documentation change.

**Why this priority**: Hard rule 8's spirit: a deviation is recorded.
Most entries exist already (D-108 to D-134).
The gap is that D-092 and D-093 still read as current.

**Independent test**: The decision-log guard passes, and a reader of D-092 or D-093 sees a pointer to the entry that replaces it.

**Acceptance scenarios**:

1. **Given** D-063 and D-064, **When** the owner reads them, **Then** each carries its "Amended by" line (D-112 and D-113), already present.
2. **Given** D-092 and D-093, **When** the owner reads them, **Then** each carries an "Amended by" line that names the entry which changed it.
3. **Given** this change, **When** the owner reads the end of the log, **Then** a new entry records what the change did, what the runbook guard test change was, and why tier 2 is shelved.

### Edge cases

- A claim in the docs cannot be checked against code (for example, a harness fact seen only in a live run).
  The docs name the source (the contract table, a result file, or a decision) and do not state it as new.
- The runbook guard test pins the old runbook.
  It must change with the runbook, and it must not get weaker (constitution principle V).
- The generated `docs/HARNESS-SUPPORT.md` is not edited by hand.
- `CLAUDE.md` and the constitution are not edited (D-117 left the `CLAUDE.md` scope text alone).
- Historical decision entries keep their text.
  A superseded one gets an "Amended by" line and nothing else.

## Requirements

### Functional requirements

- **FR-001**: `docs/LIVE-CHECK.md` MUST describe tiers 0, 1, 1.5, and 2 in one section, each with its brain, credential, and spend.
- **FR-002**: The runbook MUST say that no tier 2 run has been done for any harness, and that tier 2 runs are shelved by the captain.
- **FR-003**: The runbook MUST give a per-harness credential table for tier 2: the credential, who creates it, and how it enters the lab.
  Only the captain creates or handles a credential.
- **FR-004**: The runbook MUST NOT say that the tier 1 stub agent is missing, and MUST give the commands that run tiers 1 and 1.5.
- **FR-005**: The runbook MUST keep every isolation rule and spend cap it has, and MUST keep the token-handling rules: no credential on a command line, in a file, or in an agent's hands.
- **FR-006**: The tier 2 spawn step MUST use `bb factoryman supervisor start` with a profile and MUST NOT name one provider as the only one.
- **FR-007**: `docs/DESIGN.md` MUST describe, in its dispatch profiles section, the profile fields, the resolution order, readiness, the model and level checks, the contract table, the worker admission rule, the `roles` block, `supervisor start`, and the validator observation.
- **FR-008**: `docs/DECISIONS.md` MUST carry the D-063 and D-064 amendments (already present), an "Amended by" line on D-092 and on D-093, and a new entry for this change.
- **FR-009**: Wording that names Claude as the only or default harness MUST go from the docs where the behavior is harness-neutral.
  Wording that is true of Claude Code only MUST say so.
- **FR-010**: Every claim MUST be checked against the code or the tool it names, and the check recorded in `research.md`.
- **FR-011**: No file under `src/`, `tools/`, `skills/`, `conformance/`, or the generated support document changes.
  The only test change is to the runbook guard and the decision-log guard, which pin the documents.
- **FR-012**: `pnpm run check` MUST pass.
  The documents follow the Google developer documentation style: sentence case headings, active voice, short sentences, one sentence per line.

### Key entities

- **Runbook**: `docs/LIVE-CHECK.md`, the owner's live-check procedure.
- **Design**: `docs/DESIGN.md`, the authoritative design.
- **Decision log**: `docs/DECISIONS.md`, one entry per deviation or finding.
- **Guard test**: a test that reads a document and pins its structure.

## Success criteria

- **SC-001**: The runbook guard and the decision-log guard pass against the new documents, and `pnpm run check` is green.
- **SC-002**: A search of the runbook for the words "stub agent does not exist" and for a Claude-only credential flow in the shared steps finds none.
- **SC-003**: The runbook's tier 2 table names all four harnesses.
- **SC-004**: Every command line in the runbook's shell blocks that calls `bb` runs inside the lab, as before.
- **SC-005**: A reviewer can trace each new claim in DESIGN.md and LIVE-CHECK.md to a file in `research.md`.

## Assumptions

- The "docs lint" of the brief means the repository's document guards (the two tests above) and `pnpm run check`.
  The repository has no separate Markdown linter, and the ESLint config ignores `docs/`.
- The runbook guard test is a document lint.
  Rewriting the runbook means changing the test that pins it, and the change is not a code change in the sense of the brief.
  The change is recorded as a deviation.
- Tier 2 credentials follow the report's section 6.4 and decision D2: Claude Code keeps the captain's token (D-092), and Codex, Pi, and omp use one dedicated OpenAI key with a provider-side cap (D-108).
- The conformance runner takes tiers 1 and 1.5 only and refuses tier 2 (`tools/conformance/args.ts`).
  Tier 0 is the runbook's own checks.
