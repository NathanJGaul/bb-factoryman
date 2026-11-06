# Milestone 0: spike checklist

Test each assumption against a real bb install and a throwaway git repo. Record every
result in `spike/RESULTS.md` using this format:

```text
## <number>. <title>
Result: confirmed | refuted | partial
Evidence: <command, output, or code that shows it>
Fallback: <what the design does if refuted or partial>
```

A refuted item that changes the architecture goes back to the project owner before
milestone 1 continues. Where an item needs the bb app UI, ask the owner to do that step.

## Plugin basics

1. **Out-of-tree install.** Build a minimal plugin with `bb plugin build` and load it
   into bb from outside the bb repo. Record the exact install path and command.
2. **Per-thread tool visibility.** Register two tools. Show that the supervisor thread
   sees both and a worker thread sees only the report tool.
3. **Read-only supervisor.** Find out whether bb's permission modes let you stop one
   thread from editing project files.
4. **Worktree removal veto.** Find out whether a plugin can veto or delay removal of a
   managed worktree, through an environment provider or an archive event.
5. **Dispatch hook ordering.** Register a `message.dispatch` hook next to the built-in
   `concurrency-limit` plugin. Record how the two orders interact.

## Machines

6. **Spawn on a machine.** Check whether `bb.sdk.threads.spawn` accepts a machine, as
   `bb thread spawn --machine` does.
7. **Disconnect detection.** Stop the daemon on a second enrolled machine. Record which
   events or API reads show that it went offline and came back.
8. **Remote prerequisites.** On a remote machine, confirm that the agent CLI is signed
   in, that no-mistakes installs and initializes, and that `gh` has scoped credentials.

## Extension surface

9. **Cross-plugin metadata.** Check whether one plugin can read another plugin's thread
   metadata.
10. **`callRpc` discoverability.** Check whether another plugin's `callRpc` to your
    plugin needs the method marked discoverable.
11. **Skill override.** Check whether a project can override a plugin skill.

## Cost and notifications

12. **Cost data.** Check whether bb exposes token or cost data to plugins.
13. **Push notifications.** Check whether the built-in push notifications plugin can
    carry an alert when a task needs attention, for example on `interaction.pending`.

## no-mistakes

Docs: https://kunchenguid.github.io/no-mistakes/ (not reachable from the design
session, so read them now).

14. **Worktree fit.** Run `no-mistakes init` and `git push no-mistakes` from inside a
    bb-managed worktree. Record any problems with the extra remote or disposable
    worktree.
15. **Headless status.** Find how a program reads run status and findings without the
    TUI. Record the commands, output format, and exit codes.
16. **Answer a finding.** Find how a program approves, fixes, or rejects a finding
    without the TUI.
17. **Who starts the run.** Decide whether the worker pushes through the gate or the
    plugin starts the run. Record the trade-off.
18. **Branch protection.** Confirm that a required-status-check rule on the default
    branch blocks a direct push that skipped the gate.

## firstmate migration

19. **Registry location.** Find where firstmate stores its project registry and what
    fields it holds: delivery mode, `yolo`, branch prefix, forge.

