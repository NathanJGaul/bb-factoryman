# Research: Supervisor start command, role advice, and the dispatch roles block

Phase 0 of `/speckit.plan`.
The Technical Context has no open `NEEDS CLARIFICATION`.
This file records the facts that the plan rests on, where each came from, and what was checked.

## R1. How the validator's agent is configured

- **Decision**: Read the top-level `agent` key of `$NM_HOME/config.yaml`, and `~/.no-mistakes/config.yaml` when `NM_HOME` is unset.
- **Evidence**:
  - The shipped file (`~/.no-mistakes/config.yaml` of 1.84.0) documents `agent` as "an ordered fallback list, for example: agent: [codex, grok]" with the options "auto, claude, codex, grok, rovodev, opencode, pi, copilot, cursor, acp:<target>", and the file sets `agent: auto`.
  - The binary's error text says "choose an available agent in ~/.no-mistakes/config.yaml" and "set 'agent' in ~/.no-mistakes/config.yaml", and its list of valid names adds `devin` and `antigravity`.
  - The binary reads `NM_HOME` for its data root ("a no-mistakes daemon is already running for this NM_HOME").
  - The `.no-mistakes.yaml` of a repository overrides some keys and not others (the file says three evidence keys are "global-only").
  Nothing in the file or the binary text says that `agent` is a repository key.
  The plan reads the global file and records the limit in D-126.
- **Alternatives rejected**:
  - `no-mistakes doctor`: its output is for people, it prints one runnable agent and no list, and a change to its wording would break the plugin silently.
  - A YAML library: a new dependency for one key, and the repository adds no dependency without the owner.
  - Asking the daemon: `axi status` shows a run, and no run exists before the hand-off.

## R2. Which bb provider matches which no-mistakes agent

- **Decision**: `claude` to `claude-code`, `codex` to `codex`, `pi` to `pi`, `acp:omp` to `acp-omp`, `opencode` to `acp-opencode`, `grok` to `acp-grok`, `cursor` to `acp-cursor`.
  Everything else maps to none.
- **Evidence**: The report's matrix, row "no-mistakes agent" (`claude`, `codex`, `pi`, only `acp:<target>` for omp), and section 3.1 (bb ships `provider-acp` with dialects for `cursor`, `opencode`, `omp`, `grok`, `hermes`, and `acp-opencode`, `acp-grok`, `acp-hermes-agent` are auto-discovered when their CLI is installed).
  The match is by CLI: the agent no-mistakes starts and the provider bb starts are the same installed program with the same sign-in.
- **Limit**: bb's readiness says the CLI is installed, new enough, and signed in for bb.
  It does not prove that no-mistakes can start it.
  The evidence says "bb reports the provider ready", and it does not say "the pipeline will run".

## R3. Does the seeded role reach the first turn

- **Decision**: Seed `{ role: "supervisor" }` in the spawn call, and let the live S9 run decide.
- **Evidence**: The worker spawn does exactly this (`src/bb/adapter.ts`, `pluginMetadata: request.metadata`), and the report says that in the lab all four harnesses showed their role tools on the first turn.
  The report's section 3.3 says bb never hot-mutates a running session, and role changes apply "only when the provider session is next constructed".
  A role present at the first session is present when the session is constructed.
- **Not yet known**: whether the skill reaches Codex and omp on the first turn.
  The report saw omp's tools next turn and its skill only after a clear, and Codex's tools only after a clear.
  Both observations were of a role stamped after the first session.

## R4. What the stamp advice depends on

- **Decision**: `contractFor(providerId).roleChange`.
- **Evidence**: `src/harness/contracts.ts` pins `next-turn` for `claude-code` and `pi`, and `clear` for `codex`, `acp-omp`, and the generic row.
  The conformance driver of each harness repeats the value as `roleChangeStep`, and the driver tests compare the two.

## R5. Thread facts that bb returns

- **Decision**: Read `providerId` from `bb.sdk.threads.get`.
- **Evidence**: The SDK types list `providerId` on the thread, and the lab's `bb thread show` prints it (`tools/conformance/real-lab.ts`, `thread()` reads `t["providerId"]`).

## R6. How a command reaches a remote machine

- **Decision**: Use `exec(command, args, { host, cwd, timeoutMs })`.
- **Evidence**: `routeExec` sends a call with a host to `createRemoteRunner`, which opens a host terminal, runs the command with a wrapper, and returns exit code and both streams.
  `runPreflight` already runs `sh -c "command -v no-mistakes"` that way.
  A call accepts `timeoutMs`, and the local runner passes it to `spawn`.

## R7. What the existing tests assume about `exec`

- **Evidence**: The fake runtime answers every unknown command with exit 0 and empty output.
  A no-mistakes hand-off test therefore sees an empty configuration, which reads as `auto`, with every provider ready.
  Tests that assert an exact list of `exec` calls for a no-mistakes hand-off exist (they will show in the first full run) and are updated with the reason in the cycle log.

## R8. The constitution

- **Decision**: Amend Principle VI to name H4 and H12, and bump to 1.4.0.
- **Evidence**: Principle VI lists the harness-independence tasks in scope, and H4 and H12 are not among them.
  The captain's decision D4 option B and the words "go with the recommendations; continue development" put both in scope.
  The amendment follows the Governance section: a written reason in `docs/DECISIONS.md` and a version bump.

## R9. The decision numbers

- **Evidence**: `docs/DECISIONS.md` ends at D-122, and the decision-log guard test requires unique headings and valid citations.
  This feature starts at D-123 and keeps the numbers in order.

## R10. The lab for the live runs

- **Evidence**: Another lane's lab runs at `/var/tmp/bblab-fm-test`.
  Earlier labs exist at `/var/tmp/bblab-conformance` and `/var/tmp/bblab-conformance-followup` and hold a pinned bb.
  The runner picks free ports, and `--lab-dir` picks the directory.
  This feature uses `/var/tmp/bblab-supervisor-start` and never touches the other labs.
