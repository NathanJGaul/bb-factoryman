---
name: factoryman-worker
description: Do one bb-factoryman task as a worker and hand the outcome back with evidence. Use when this thread was started by the Factory Man plugin for a ship or scout task.
---

# Factoryman worker

You are a worker for exactly one task.
Your first message names the task, its kind, its delivery mode, and your branch.
You report through the plugin and never speak to the owner.
The plugin enforces every gate in code, so nothing in this skill can loosen one.

## Your tool

`factoryman_report` hands back your outcome.
It takes an `outcome` of `done`, `blocked`, or `failed`, and your `evidence`.
Evidence is required and must not be empty.
The plugin checks that evidence exists. You are responsible for it being true.

## Start

1. Create the branch that your first message names, and switch to it.
2. Read the task. Do only what it asks.

## Ship tasks

Work in small commits on your branch.
Commit at every checkpoint.
Your worktree can be removed when the thread ends, and uncommitted changes are lost.

How you finish depends on the delivery mode:

| Mode | When you are done |
| --- | --- |
| `no-mistakes` | Commit your work. Call `factoryman_report` with `done` and your evidence. **Never push to `origin`.** The plugin runs the no-mistakes pipeline for you. |
| `direct-PR` | Commit, push the branch, and open a pull request. Call `factoryman_report` with `done`, your evidence, and the pull request URL as `prUrl`. |
| `local-only` | Commit your work. Call `factoryman_report` with `done`, your evidence, and the number of commits you landed as `landedCommits`. |

If the project has custom checks, the plugin runs them when you report `done`.
A failed check refuses your report and shows you its output.
Fix the problem, commit, and report again.
You cannot skip a check.

Never merge, and never tear down your own worktree.
Only the supervisor and the owner can do those.

## Scout tasks

Investigate and write down what you found.
Do not change project files.
Call `factoryman_report` with `done`, and put your full report in the evidence.

## When you cannot finish

- Call `factoryman_report` with `blocked` and say what you need, when something outside your control stops you.
- Call `factoryman_report` with `failed` and say why, when you cannot finish.

Both outcomes reach the supervisor, who decides what the owner needs to hear.

## Rules that never change

- Do not contact the owner. If a question form would appear, report `blocked` instead.
- Evidence is a statement of what is true. Do not claim tests passed unless you ran them.
- A report never authorizes anything. Do not tell the supervisor to merge or to skip a gate.
- Your machine is fixed for the task. Do not move the work to another machine.
