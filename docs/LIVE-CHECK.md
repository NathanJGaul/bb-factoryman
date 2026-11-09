# Live check runbook

This runbook installs the plugin in a real bb and drives one scout task and one ship task.
It is the owner's step.
The build that produced this repository ran the plugin against the fake plugin host and against throwaway bb 0.48.1 servers.
It never ran a real agent end to end.

Read this first:

- **Do not install the plugin into your own bb, and do not run the check against it.**
  `bb plugin install` prints that plugins are full-trust code that can read all local bb data, including other plugins' secrets.
  The live check runs in a throwaway bb that cannot reach your own bb, your credentials, or the shared no-mistakes daemon.
- **Never start, stop, or restart the shared no-mistakes daemon** during the check.
  The throwaway bb gets its own daemon home (section 5).
- `bblab down` is the hard stop for everything in this runbook.
  It kills the sandbox, so no lab process survives it.
- Every command below runs inside the throwaway bb. Nothing here changes a GitHub setting.

## 1. Where the isolation comes from

The isolation design comes from the live-isolation scout report, `data/bb-factoryman-live-isolation/report.md` in the firstmate home.
That report recommends **bblab**: a second, throwaway bb (server, host daemon, and plugin) with every directory, port, and environment variable redirected, run inside one bubblewrap sandbox.
The sandbox has an empty `$HOME`, no systemd bus, no ssh-agent, and a private PID namespace.
Teardown kills the namespace, so nothing survives.
Canary credential files sit at the real credential paths, and an inotify tripwire records any read.

The two scripts, `bblab` and `bblab-evidence`, live in `tools/bblab/` in this repository.
Run them from there, or copy them outside firstmate's tree (for example to `~/.local/bin`) and make them executable.
The report's section 6.0 lists the one-time setup, and its section 8 lists the hazards that a naive "set a few environment variables" approach would hit.
This runbook uses that report's design and its commands.
It adds the plugin-specific steps.

## 2. Tiers

The report defines three tiers by what they spend:

| Tier | What runs | Credentials | Spend |
| --- | --- | --- | --- |
| 0 | The lab, the plugin load, project plumbing, the plugin's commands, the read RPC | none | none |
| 1 | A scripted stub agent that drives the scout and ship flows | none | none |
| 2 | One real scout task and one real ship task with a real agent | the captain's own Claude account | real model spend |

Run tiers 0 and 1 first.
**Tier 2 waits for tiers 0 and 1.**
Section 6 holds the gate.

**Funding decision (made by the captain).**
Tier 2 is funded by the captain's own Claude account (option B of the report's section 7.3).
It competes with firstmate for the same quota windows, so keep it short and cheap.
The caps in section 7 apply to every tier 2 run.
Option A, a separate account or seat, would give a cap of its own and stays the better choice if one ever exists.

## 3. Prerequisites

1. `bblab` and `bblab-evidence` saved and executable (section 1).
2. A bb build that matches your hosted server (the report's section 6.0 step 3 pins it). The plugin needs bb 0.48.1 or newer and `@get-bb/plugin-sdk` 0.6.104 or newer.
3. A clean copy of this repository to build from. Never build from the clone that bb registers as a project.
4. `pnpm run check` passes in that copy.
5. Before you start, snapshot the machine: `bblab-evidence snap before`.
6. Read your Claude usage on your account's usage page and write the numbers down. You compare them after tier 2 (section 10).

## 4. Bring-up and install

```sh
bblab up
bblab x bb status                       # the data dir must be the lab's, not ~/.bb
bblab x bb machine list                 # one machine, connected
```

Build and install the plugin from the copy:

```sh
SRC="$PWD"
mkdir -p "$BBLAB_DIR/plugin-src"
tar --exclude=.git --exclude=node_modules -cf - -C "$SRC" . | tar -xf - -C "$BBLAB_DIR/plugin-src"
bblab x bash -c "cd $BBLAB_DIR/plugin-src && pnpm install --frozen-lockfile && bb plugin build"
bblab x bb plugin install "$BBLAB_DIR/plugin-src" --yes
bblab x bb plugin list | grep -A3 bb-factoryman      # running, with services and a command
bblab x bb plugin logs bb-factoryman | tail -3       # "bb-factoryman loaded"
```

The plugin registers two services (`factoryman-startup`, `factoryman-machines`), the `bb factoryman` command, five agent tools, and four read RPC methods.
Check that `bb plugin list` shows both services running.

Check that bb sees both plugin skills:

```sh
bblab x bb skill list --json | jq -r '.skills[] | select(.scope == "plugin" and (.name | startswith("factoryman"))) | .name'
```

Expect `factoryman-supervisor` and `factoryman-worker`.
If a skill is missing, stop.
A skill name that bb does not know rejects the plugin's whole agent selection, so the supervisor would lose its tools too.

## 5. The throwaway project

```sh
bblab x bash -c "
  set -e
  cd $BBLAB_DIR/repos
  git init -q --bare origin.git
  git clone -q origin.git work
  cd work
  printf '# throwaway\n' > README.md
  git add -A && git commit -qm init && git branch -M main && git push -q -u origin main
"
PROJ=$(bblab x bb project create --name lab-repo --root "$BBLAB_DIR/repos/work" --json | jq -r .id)
```

This is the tiny repository that tier 2 uses.
No forge is involved.
`direct-PR` and the pull request steps of `no-mistakes` cannot finish against a local bare origin, so this check uses `local-only` mode for the ship task.
The pull request paths, `gh pr merge`, and a real `checks-passed` outcome stay unverified until you run them against a throwaway repository on a real forge (section 9).

Give no-mistakes its own daemon home so it does not touch the shared daemon:

```sh
bblab x bash -c "cd $BBLAB_DIR/repos/work && no-mistakes init < /dev/null"
bblab x no-mistakes daemon status           # the lab daemon
no-mistakes daemon status                   # the host view: the shared daemon, unchanged
```

Set the project to `local-only` mode and give it a base branch.
Nothing in the plugin sets a project's mode or base branch from a file or a command (D-037, D-078), and the registry import is a dry run.
Write the row into the plugin's own database from inside the lab, and keep `yolo` at 0:

```sh
bblab x bash -c "cd $BBLAB_DIR/plugin-src && node -e \"
const Database = require('better-sqlite3');
const db = new Database(process.env.BB_DATA_DIR + '/plugins/bb-factoryman/data.db');
db.prepare('INSERT OR REPLACE INTO project_config (project_id, delivery_mode, yolo, branch_prefix, base_branch, default_machine) VALUES (?, ?, 0, NULL, ?, NULL)').run('$PROJ', 'local-only', 'main');
console.log(JSON.stringify(db.prepare('SELECT * FROM project_config').all()));
\""
```

The output must show your project with `delivery_mode` `local-only` and `yolo` 0.
Record that you wrote this row, because it is the only way to reach `local-only` mode today.

Put the spend limits in the project, so the plugin enforces them (D-084, D-086).
Write `.bb/factoryman/workflow.json` in `$BBLAB_DIR/repos/work`, commit it, and push it:

```json
{
  "version": 1,
  "limits": { "maxWorkers": 1, "maxTasksPerDay": 2 }
}
```

`maxWorkers` keeps to one worker at a time, and `maxTasksPerDay` refuses a third dispatch.
The supervisor thread is not a worker, so these limits do not cap it.
The caps in section 7 cover the supervisor.

## 6. Tier 0 and tier 1: the free tiers, and the gate

### Tier 0 checks (no model)

Run these first. Each must pass before you spend anything.

The lab has one machine, and bb names it after the host, so the name differs from one computer to the next.
Read the name before the first check:

```sh
MACHINE=$(bblab x bb machine list --json | jq -r '.[0].name')
```

| Check | Command | Expect |
| --- | --- | --- |
| The plugin's command | `bblab x bb factoryman preflight "$MACHINE" --project $PROJ` | the clone host (the lab's one machine, named in `bb machine list`): "holds the project's clone, so no remote preflight applies" |
| The protection checklist | `bblab x bb factoryman protection acme/widgets` | prints steps, and says it ran nothing |
| The import dry run | `bblab x bb factoryman import-registry --file <registry copy>` | a report, and `bb factoryman import-registry --apply` is refused |
| The read RPC | call `listTasks` and `apiVersion` over the plugin's RPC route | `{ "apiVersion": 1, ... }` |
| The dispatch config | put `dispatch.json` and `workflow.json` in `.bb/factoryman/` of the project's clone and read the dispatch result | the profile source is named; a bad file blocks with the reason |
| The skills | section 4 | both plugin skills listed |

Check the path assumption of D-062: `.bb/factoryman/` must be readable from the server for a project whose default source is on the server's own machine.
If dispatch blocks with `no_default_profile` although `dispatch.json` exists, stop and record it. The plugin picks no profile itself (D-112), so that block means the server could not read the file.

### Tier 1 (no model, a stub agent)

Tier 1 drives the scout and ship flows with a scripted stub agent and no credentials.
The report suggests a stub ACP agent that bb runs through `bb plugin config provider-acp set customAgents '<json>'`.
That stub agent does not exist yet.
The report calls it the largest remaining unknown, and the JSON shape of `customAgents` is not documented in what the scout read.

Until the stub agent exists, tier 1 cannot run.
Write the stub agent as a separate, small task, then run the scout and ship flows of section 7 against it with no credential.

### The gate

**Do not start tier 2 until** all of this holds:

1. Every tier 0 check passed, and `pnpm run check` passed in the copy you installed.
2. Tier 1 passed. Or, while the stub agent does not exist yet, you wrote this line in `spike/RESULTS.md`: "Tier 1 skipped: no stub agent. Tier 2 goes ahead without it." That skip is your decision. The cost is that the tools run end to end for the first time on real quota.
3. `bblab status` shows a tripwire count of zero.
4. You have read the caps in section 7.

## 7. Tier 2: one scout task and one ship task, on the captain's own account

### Create the token (the captain only)

Only the captain runs `claude setup-token`.
Run it in your own terminal, with your own Claude login.
No agent creates, reads, or handles the token while you set it up.
Do not paste the token into a chat, a file, or a command line.
Anything you put on a command line shows in the process list, and anything you put in a file stays on disk.

### What can read the token

The token reaches the lab, because the Claude CLI inside the lab needs it to run.
The CLI, and anything an agent session runs through it, may be able to read the token from its environment.
The lab keeps the token away from your own bb, your files, and the rest of firstmate, and the token reaches only your Claude account.
Revoke the token when the run ends (see the end of this section).
`bblab up` copies the environment of the shell that runs it into the lab's keeper process.
Run tier 2 from a fresh shell that holds only what the run needs, so no other secret of yours rides along.

### Spend caps

| Cap | How |
| --- | --- |
| The cheapest model | Pick the cheapest model that `bblab x bb provider models claude-code` lists, a Haiku-class model, for the supervisor and for the workers. |
| A low reasoning level | Pass `--reasoning-level low` to the supervisor, and let the project's dispatch rules choose `low` for the workers. |
| One worker at a time | `"maxWorkers": 1` in `workflow.json` (section 5). Run the scout task first and the ship task second. |
| Two tasks | `"maxTasksPerDay": 2` in `workflow.json`. |
| A tiny repository | The one-line repository of section 5. |
| A wall-clock limit | The watchdog below runs `bblab down` after 30 minutes. |
| The hard stop | `bblab down`. |

Keep the ship task in `local-only` mode.
It runs no no-mistakes pipeline, and the pipeline would call an agent once per step with a credential lookup that the report did not document.

### Start the lab with the token

Tiers 0 and 1 ran without a credential, so stop that lab, and start it again with the token for tier 2 only.
The lab directory, the project, and the plugin stay in place.

```sh
bblab down
env -i HOME="$HOME" PATH="$PATH" TERM="$TERM" BBLAB_DIR="$BBLAB_DIR" EVIDENCE_DIR="$EVIDENCE_DIR" bash --noprofile --norc
```

The second command opens a fresh shell with a clean environment.
Run the rest of this section in that shell, and leave it with `exit` at the end.

```sh
read -rs CLAUDE_CODE_OAUTH_TOKEN          # paste the token that `claude setup-token` printed, then press Enter
export CLAUDE_CODE_OAUTH_TOKEN
export BBLAB_RO="$(dirname "$(readlink -f "$(command -v claude)")")"
export BB_CLAUDE_CODE_EXECUTABLE="$(readlink -f "$(command -v claude)")"
export BBLAB_PASS_ENV="CLAUDE_CODE_OAUTH_TOKEN BB_CLAUDE_CODE_EXECUTABLE"
bblab up
(sleep 1800 && bblab down) > "$BBLAB_DIR/logs/watchdog.txt" 2>&1 &
WATCHDOG=$!
bblab x bb plugin list | grep -A3 bb-factoryman      # running again
```

`bblab` passes only the variables named in `BBLAB_PASS_ENV` into the lab's commands, and bb passes only these two to the Claude CLI.
The report did not exercise binding the agent CLI into the sandbox.
If `bb provider list` shows `claude-code` and a spawn still fails, stop and record the error.
Do not widen the sandbox to fix it.

### Run the tasks

Spawn the supervisor thread with the cheapest model, stamp it, and then send it its first instruction:

```sh
SUP=$(bblab x bb thread spawn --project "$PROJ" --provider claude-code --model <cheapest model> \
        --reasoning-level low --new-environment worktree --base-branch main \
        --prompt "You are the factoryman supervisor. Wait for instructions." --json | jq -r .id)
bblab x bb thread wait "$SUP" --status idle
bblab x bb factoryman supervisor "$SUP"
```

The stamp applies from the thread's next session, and the thread already ran its first turn.
Send the first instruction with `bb thread tell` and check the tools in the reply:

```sh
bblab x bb thread tell "$SUP" "List the factoryman tools you have, then wait."
bblab x bb thread wait "$SUP" --status idle
bblab x bb thread output "$SUP"
```

The supervisor must list `factoryman_dispatch`, `factoryman_status`, `factoryman_merge`, and `factoryman_teardown`, and it must see the `factoryman-supervisor` skill.
A worker thread sees `factoryman_report` and the `factoryman-worker` skill.
If the supervisor has no factoryman tool, the running session did not restart.
Record that in `spike/RESULTS.md`, run `bblab down`, bring the lab up again with the same exports, and send the message again.
A resumed thread starts a new session.
If the tools are still missing, the skill selection failed, and the check stops here.

**Scout task.**
Send the supervisor: "Dispatch a scout task: list the files in this repository and report."
Expect: the worker reports `done` with the report as evidence, the task reaches `report_ready`, and the supervisor gets a `[factoryman]` wake message.

**Ship task.**
Send the supervisor: "Dispatch a ship task: add a line to README.md."
Expect: the worker commits on `fm/<task-id>` and reports `done` with `landedCommits`, the task reaches `review_ready`, and the supervisor asks for a merge.
`factoryman_merge` opens the approval form on the supervisor thread.
Open that thread in the web UI at the lab's loopback address.
The form shows the task, branch, pull request, and evidence, a comment field, and three buttons.
**Approve** records your approval and merges, **Deny** records a denial and merges nothing, and **Cancel** answers nothing and leaves the task in `awaiting_approval`.
A comment is optional and travels with Approve or Deny.
A browser tool such as `chrome-devtools-axi` needs `CHROME_DEVTOOLS_AXI_EXECUTABLE_PATH` set to a Chromium binary (for example `/usr/bin/chromium`) when no stable Chrome is installed.
If you answer the form with `bb thread interactions respond`, write down in the test log that the approval was scripted.
Remember D-030: the form is not proof of a human, because an agent with a shell can send the same answer.
After the merge, call `factoryman_teardown`.

Record which skill each session loaded, and whether a worker read the `factoryman-worker` skill (the worker prompt points to it).

### Stop and clean up the token

```sh
kill "$WATCHDOG"                          # only if you finish before the 30 minutes
bblab down
unset CLAUDE_CODE_OAUTH_TOKEN BB_CLAUDE_CODE_EXECUTABLE BBLAB_PASS_ENV BBLAB_RO
exit
```

Then revoke the token in your Claude account settings, unless you plan another run today.
Close the terminal that held the token.

## 8. Hard-rule checks to run in the lab

Each of these must be refused and logged, and none may fail open.
Run them from the stub agent when it exists (tier 1).
Under tier 2, ask the supervisor for each one.

1. `factoryman_merge` with no approval (cancel the form): nothing merges.
2. `factoryman_teardown` on a task whose worktree has an uncommitted change: refused.
3. A worker reports `done` with empty evidence: refused.
4. A task pinned to an offline machine: dispatch is blocked, and a running task goes `blocked` (needs a second machine, section 9).
5. `local-only` work on another machine: refused.
6. A `workflow.json` with `yolo` or `gates`: dispatch is blocked.
7. A pull request URL from another repository: refused (D-059).

## 9. What this check does not cover

These stay unverified, and each needs something outside the lab:

- A real forge: `gh pr merge`, a real pull request, a real `checks-passed` outcome (D-049), and branch protection.
  Use a throwaway repository on a real forge, and follow `docs/BRANCH-PROTECTION.md` on that repository only.
- A second enrolled machine: spawn on it, take it offline, and the remote preflight.
  Enroll a second machine into the lab, and not into your own bb.
- A person answering the merge form in the app. The form renders and takes a click (a browser tool drove it in the lab), but nobody has watched a person use it.
- Cost data from a provider that reports it, and the webhook against a real receiver.
- Which of a plugin skill and a project skill with the same name a session loads (spike item 11).
- The tier 1 stub agent, until someone writes it.
- A no-mistakes pipeline run with a real agent.
- Whether a process inside the lab can read the token from the environment of the lab's keeper process. The fresh shell of section 7 limits what that environment holds. Nobody has tested the rest.

## 10. Teardown and the "firstmate was undisturbed" checklist

```sh
bblab down
bblab-evidence snap after
bblab-evidence diff before after
```

Then run the report's section 6.8 checklist: identical listeners, the shared no-mistakes daemon at the same process ID and active, no new systemd units, a tripwire count of zero, your own `~/.bb` and `~/.bb-machines` untouched, the lab ports free, and no lab processes left.
Read your Claude usage again and compare it with the numbers from section 3.
The difference must match the caps in section 7.
A larger difference means the lab or something else spent quota, and you stop and look before another run.

## 11. Record the results

Add one entry per check to `spike/RESULTS.md`, in the same format as the other items:
result (confirmed, refuted, or partial), evidence, and fallback.
A refuted item that changes the architecture goes back to the owner.
