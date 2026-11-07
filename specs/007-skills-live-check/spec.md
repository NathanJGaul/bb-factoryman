# Feature specification: Skills and live check

**Feature branch**: `fm/bb-factoryman-milestones-7-11`

**Created**: 2026-11-07

**Status**: Approved (scope fixed by the captain's intent for this task)

**Input**: Milestone 11 of `docs/DESIGN.md`: "Write the supervisor and worker skills. Done when you install the plugin in bb and run one scout task and one ship task. I can't run bb here, so this step is yours."
The brief limits this milestone: write the skills and a live-check runbook, and do not install into or run a live bb as the shared default instance.
The live isolation scout's report (`data/bb-factoryman-live-isolation/report.md` in the firstmate home) decides how the owner runs the check without disturbing firstmate.
The captain decided how the model-backed tier is funded: the captain's own Claude account, with the caps in section 7.3 of that report, and with the free tiers first.

## User scenarios and testing

The people who use this feature are the supervisor and worker agents, who read the skills, and the owner, who runs the live check from the runbook.
The feature has no screen.
Its real entry points are the plugin's agent configuration (which selects the skills by thread role), the skill files, and the runbook.
The bb facts it depends on are spike item 11 and the plugin skill convention in `spike/RESULTS.md`.

### User story 1 - Give each role its skill (priority P1)

**Acceptance scenarios**:

1. **Given** a supervisor thread, a worker thread, and a thread with no role, **When** bb resolves the agent configuration, **Then** the supervisor gets `factoryman-supervisor`, the worker gets `factoryman-worker`, and the third gets no skill. (AC-1.1)
2. **Given** the `skills/` directory, **Then** it holds exactly the two skills, and each `SKILL.md` has a `name` that matches its directory and a one-line `description`. (AC-1.2)
3. **Given** each skill, **Then** it names every tool of its role and no tool that the plugin does not register. The worker skill names no supervisor tool. (AC-1.3)
4. **Given** each skill, **Then** it names only `bb factoryman` commands that the plugin registers. (AC-1.4)
5. **Given** each skill, **Then** it says that the plugin enforces every gate in code, and it carries the role's rules: the supervisor never edits project files and cannot answer a finding, and the worker never pushes to `origin` in `no-mistakes` mode, never contacts the owner, and must give evidence. (AC-1.5)
6. **Given** the worker's first message, **Then** it points to the `factoryman-worker` skill. (AC-1.6)

### User story 2 - Hand the owner a live-check runbook (priority P1)

**Acceptance scenarios**:

1. **Given** `docs/LIVE-CHECK.md`, **Then** it says not to install into the owner's own bb, never to touch the shared no-mistakes daemon, and to run in the throwaway bb that the isolation report describes. (AC-2.1)
2. **Given** the runbook, **Then** it holds the tiers, the funding decision, the bring-up and install steps, the tier 0 checks, one scout task, one ship task, the hard-rule checks, the teardown checklist, and what the check does not cover. (AC-2.2)
3. **Given** the runbook, **Then** every command it names for this plugin exists (`bb factoryman supervisor`, `preflight`, `protection`, `import-registry`), and every tool it names is registered. (AC-2.3)

### User story 3 - Fund the model-backed tier on the captain's own account (priority P1)

**Acceptance scenarios**:

1. **Given** the runbook, **Then** tier 2 is funded by the captain's own Claude account, and the runbook says that this competes with firstmate for the same quota. (AC-3.1)
2. **Given** the runbook, **Then** it holds the spend caps: the cheapest model, a low reasoning level, one worker at a time, a tiny repository, a wall-clock limit, and `bblab down` as the hard stop. (AC-3.2)
3. **Given** the runbook, **Then** the captain runs `claude setup-token` and passes `CLAUDE_CODE_OAUTH_TOKEN` into the lab through `BBLAB_PASS_ENV`. The runbook never asks an agent to create, read, or handle the token, and it never puts the token in a file or a command line. (AC-3.3)
4. **Given** the runbook, **Then** it runs tiers 0 and 1 first and makes tier 2 wait for them, and it says what happens while the tier 1 stub agent does not exist. (AC-3.4)

### Edge cases

- A project can add its own skill with a different name. A project skill with the same name appears beside the plugin's (spike item 11), and which one a session loads is not known.
- The supervisor skill is advice. The gates do not depend on it.

## Requirements

- **FR-1101**: The agent configuration MUST select `factoryman-supervisor` for a supervisor thread and `factoryman-worker` for a worker thread by plugin metadata, and no skill otherwise.
- **FR-1102**: The skills MUST live in `skills/<name>/SKILL.md` with `name` and `description` front matter.
- **FR-1103**: A skill MUST NOT name a tool or a command that the plugin does not register, and the worker skill MUST NOT name a supervisor tool.
- **FR-1104**: A skill MUST state that gate behavior lives in code.
- **FR-1105**: The worker prompt MUST point to the worker skill.
- **FR-1106**: The runbook MUST NOT tell the owner to install into the shared bb or to touch the shared no-mistakes daemon.
- **FR-1107**: The runbook MUST be based on the isolation report and MUST mark what stays unverified.
- **FR-1108**: The runbook MUST fund tier 2 from the captain's own Claude account, MUST carry the report's spend caps, and MUST gate tier 2 on tiers 0 and 1.
- **FR-1109**: The runbook MUST have the captain create the token and pass it through `BBLAB_PASS_ENV`, and MUST NOT write the token anywhere or ask an agent to handle it.

## Success criteria

- **SC-1101**: A supervisor, a worker, and a plain thread each get the right skills.
- **SC-1102**: The runbook is complete enough for the owner to run it without asking.
- **SC-1104**: A reader who follows the runbook spends model quota only after tiers 0 and 1 have passed, and only within the stated caps.
- **SC-1103**: The suite, type check, lint, and `bb plugin build` pass.

## Assumptions

- Plugin skills live in `skills/<name>/SKILL.md` and are selected by front matter name (spike item 11 and the scaffold convention).
