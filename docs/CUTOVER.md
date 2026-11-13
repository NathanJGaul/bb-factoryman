# Cutover from firstmate

Move projects to the plugin one at a time.
A branch must never be driven by both systems.
In-flight tasks are not imported: finish them in firstmate first.

## Steps

1. Preview the move. The command only reads firstmate's registry and changes nothing:

   ```sh
   bb factoryman import-registry --file /path/to/firstmate/data/projects.md
   ```

   The report lists each registered project with its mode, `yolo` flag, branch prefix, and forge, and the bb project that matches its name.
   Read every line that the report flags.
2. Pick one project. Finish or abandon its firstmate tasks, so no firstmate worker owns a branch in it.
3. Set up the backstop for that project: see `docs/BRANCH-PROTECTION.md`.
   Then copy the project's registry line into its stored config:

   ```sh
   bb factoryman import-registry --file /path/to/firstmate/data/projects.md --apply --project <name>
   ```

   The command writes the delivery mode, `yolo` flag, and branch prefix of that one project.
   A `local-only` project also needs a base branch, because merge and teardown refuse without one.
   The registry has no base branch, so you type it:

   ```sh
   bb factoryman import-registry --file /path/to/firstmate/data/projects.md --apply --project <name> --base-branch <branch>
   ```

   Without `--base-branch` the command leaves the stored base branch as it is.
   When the project is `local-only` and has no base branch, the output ends with a `Warning:` line.
   Run the command again with the flag to fix it.
   The command does not check that the branch exists, so name the branch that the project's checkout keeps.
   It refuses and writes nothing when the report flags the line, when bb does not know the project, or when the name matches more than one line or project.
   It prints what it wrote and what it left unchanged, and a second run writes nothing.
4. In that project, put the rules in `.bb/factoryman/dispatch.json` and the checks and limits in `.bb/factoryman/workflow.json`.
   An optional `roles` block there sets the supervisor profile and marks the validator agent as `observe` (see `specs/011-supervisor-start-roles/contracts/dispatch-roles.md`).
5. Start the project's supervisor with `bb factoryman supervisor start --project <id> --profile <name>`, or run `bb factoryman supervisor <thread-id>` on a supervisor thread that already exists and follow the advice that it prints.
6. Dispatch one scout task and one ship task, and watch them through `factoryman_status`.
7. Stop using firstmate for that project.
8. Repeat for the next project.

## What the import does not do

- It never applies without `--apply` and `--project`. The dry run is the default, and the apply writes one project at a time.
- It writes the delivery mode, `yolo` flag, and branch prefix, and the base branch only when you pass `--base-branch`.
  It never guesses a base branch, never reads one from a file in the checkout, and does not check that the branch exists.
  The default machine stays as stored, and the forge is printed and not stored.
- It does not turn `yolo` on from a bare `yolo` token. Only `+yolo` does, and a flagged line is not written at all.
- It does not change tasks that exist. A task keeps the mode it was created with.
- It does not import tasks, approvals, or history.
- It does not touch firstmate.
