# Quickstart: check `factoryman_decide`

Run these from the repository root.

## 1. The fast checks

```sh
pnpm run check
```

Expected: type check, lint, and the whole suite pass, and `ls /tmp` shows no new `bb-factoryman` directory afterward.

## 2. The tool against the fake validator

```sh
pnpm vitest run test/acceptance/tools-decide.test.ts
```

Expected: every answer (`approve`, `skip`, `fix`, `rerun`) reaches the fake validator only after the form is approved, and each refusal sends nothing.

## 3. The form

```sh
pnpm vitest run src/app/decision-approval-form.test.tsx
```

Expected: the form shows each finding and the exact answer, offers no Approve for an unreadable payload, and submits `approved`, `denied`, or a cancel.

## 4. The pipeline command line

```sh
pnpm vitest run src/validator/no-mistakes.test.ts test/acceptance/tools-decide.test.ts -t "yes"
```

Expected: the command that the adapter runs for an answer holds no `--yes` and no `-y`.

## 5. The harness suite, offline

```sh
pnpm run conformance -- --tier 1
pnpm run conformance -- --tier 1.5 --harness claude-code --offline
pnpm run conformance -- --tier 1.5 --harness codex --offline
pnpm run conformance -- --tier 1.5 --harness pi --offline
pnpm run conformance -- --tier 1.5 --harness omp --offline
pnpm run conformance:docs
```

Expected: five runs exit 0 with a clean isolation check, S5 and S9 show five supervisor tools, and S8 shows `S8.decide-wrong-state` as passed.
The lab needs `bwrap` and the harness CLIs, and no credential.

## 6. The documents

```sh
pnpm vitest run test/acceptance/design-profiles.test.ts test/acceptance/decision-log.test.ts test/acceptance/skills.test.ts
```

Expected: the design lists the tool, the log has D-136 on, the constitution is 1.5.0, and the skill tells the supervisor to use the tool.
