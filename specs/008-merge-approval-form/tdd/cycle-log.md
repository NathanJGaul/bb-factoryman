# Cycle log: Merge approval form in the web UI

Append only.
Newest last.
Every entry's `red` block is the evidence that the test existed and failed before the implementation.
The group commits its tests with stubs first, so git history shows the order.

## Baseline

- suite: `pnpm test` -> 92 files, 1134 passed, 0 failed
- commit: `bbfdb15`

## Setup before the first cycle (tasks T1201 to T1203)

The plan fixed these dependency and configuration changes, and they carry no behavior of their own.
Commit `576154c`: `react`, `react-dom`, `@types/react`, `@types/react-dom`, `@testing-library/react`, `@testing-library/dom`, and `jsdom` as dev dependencies; `jsx` and the `DOM` lib in `tsconfig.json`; `*.test.tsx` in the `vitest` include.
A throwaway `.tsx` test confirmed that JSX runs under jsdom and was deleted before the commit.
The suite stayed green (92 files, 1134 passed), and `tsc6 --noEmit` and `eslint .` passed.
The profile says setup adds no dependency "as a side effect"; this was not a side effect but a step of the approved plan (`plan.md`, technical context).

## Group 1: the type check runs with `tsc6` (A1214, A1215)

The `tsconfig.json` change of the setup commit existed before the test for A1215, which would have made the test pass on its first run.
To get a real red, the cycle reverted `lib` and `jsx` in `tsconfig.json` to their old values, wrote the tests, observed them fail, and then restored the file.

- test: `test/acceptance/manifest.test.ts` `[A1214]` and `[A1215]` (new)
- red: `pnpm vitest run test/acceptance/manifest.test.ts` -> 2 failed, 2 passed
  - `[A1214]`: `AssertionError: expected 'tsc --noEmit' to match /^tsc6(\s|$)/`
  - `[A1215]`: `AssertionError: expected undefined to be 'react-jsx'`
- bug reproduction (T1241): `env -i HOME=$HOME PATH=<node bin>:/usr/bin:/bin pnpm exec sh -c 'tsc --noEmit'` -> `tsc: command not found`
- green: `package.json` `typecheck` is now `tsc6 --noEmit`, and `tsconfig.json` is back to the setup state.
  - `env -i HOME=$HOME PATH=<node bin>:/usr/bin:/bin pnpm run check` -> typecheck, lint, and `vitest` pass: 92 files, 1136 passed, 0 failed.
- refactor: none needed
- commit: see git history, "fix: type-check with tsc6 so pnpm run check needs no global tsc"

## Group 2: the browser side imports no server code (A1221, task T1204)

- test: `test/acceptance/lint-isolation.test.ts` `[A1221]` (three tests, new): server imports fail lint in each browser-side file, the frontend's own imports pass, and the same imports pass in server files and in the browser side's tests.
- red: `pnpm vitest run test/acceptance/lint-isolation.test.ts` -> 1 failed, 13 passed
  - `[A1221] fails lint on a server-side import in each browser-side file`: `AssertionError: src/app.tsx importing a node: built-in: expected [] to have a length of 1 but got +0`
  - The other two `[A1221]` tests passed on their first run. They guard against a rule that restricts too much, so there was nothing to fail before the rule existed.
- deliberate mutants, run after green (the tests must fail with the rule broken, and the rule was restored byte for byte):
  - allow-list entry for `@get-bb/plugin-sdk/app` removed -> `[A1221] passes lint on the imports that the frontend needs` failed: `src/app.tsx: import { definePluginApp } from "@get-bb/plugin-sdk/app";: expected [ Array(1) ] to deeply equal []`
  - test-file exemption removed -> `[A1221] passes lint on the same server-side imports outside the browser side, and in the browser side's own tests` failed: `expected [ …(2) ] to deeply equal []`
- green: `eslint.config.js` gained a browser-side block for `src/app.tsx`, `src/app/**`, and `src/approval/**` (tests excluded). It bans Node built-ins, `better-sqlite3`, `zod`, the backend SDK root and every SDK subpath except `app`, and every other entry of `src/`, read from the directory.
  - One lint error on the way: `URL` is undefined in the config file, so it uses `import.meta.dirname`.
  - `pnpm run check` -> 92 files, 1139 passed, 0 failed
- refactor: none needed
- commit: see git history, "feat: keep the frontend free of server imports with a lint rule"
