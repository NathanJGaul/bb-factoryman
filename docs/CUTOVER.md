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
4. In that project, put the rules in `.bb/factoryman/dispatch.json` and the checks and limits in `.bb/factoryman/workflow.json`.
5. Run `bb factoryman supervisor <thread-id>` on the project's supervisor thread.
6. Dispatch one scout task and one ship task, and watch them through `factoryman_status`.
7. Stop using firstmate for that project.
8. Repeat for the next project.

## What the import does not do

- It does not write the project's config. A project starts in `no-mistakes` mode with `yolo` off until a person sets the stored config.
  The apply path is a follow-up that needs the owner's decision.
- It does not import tasks, approvals, or history.
- It does not touch firstmate.
