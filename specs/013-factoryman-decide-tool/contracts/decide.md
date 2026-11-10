# Contract: `factoryman_decide`, its form, and the driver additions

## Tool

Name: `factoryman_decide`.
Offered to: threads whose plugin metadata says `role: supervisor`.
Not offered to: workers and threads with no role.
Description for bb: "Answer a pending no-mistakes finding for a task in needs_decision. The owner approves the exact answer in a form first."

### Arguments

```ts
{
  taskId: string;
  key: string;
  action: "approve" | "skip" | "fix" | "rerun";
  findingIds?: string[];   // fix only
  instructions?: string;   // fix only
}
```

The JSON schema that bb advertises is the flat object from `z.toJSONSchema` of a strict object, with an `enum` for `action`.

### Results

All results are text with `isError`.

| Situation | `isError` | Text starts with |
| --- | --- | --- |
| A worker calls it | true | `Refused (actor_forbidden):` |
| A bad argument object | true | `Refused (invalid_event):` |
| No such task in this project | true | `No task <id> exists in this project.` |
| Not a ship task, or not in `needs_decision` | true | `Refused (illegal_transition):` |
| A form for the task is open | true | `A decision form for task <id> is already waiting for the owner.` |
| The live view cannot be read | true | `Decision refused: the pipeline's live state cannot be read (...)` |
| The key differs from the live key | true | `Decision refused: the key does not match the live gate.` and the live key and finding IDs |
| The answer breaks a rule | true | `Decision refused: ...` with the reason |
| Cancelled, timed out | true | `The owner did not answer the decision form (<reason>). ...` |
| Unreadable reply | true | `The decision form came back with an unreadable answer, so nothing was sent.` |
| Denied | true | `The owner denied the answer...` |
| The gate changed while the form was open | true | `Decision refused: the gate changed while the form was open. Nothing was sent.` |
| The validator rejected the answer | true | `The pipeline did not accept the answer: <reason>. The task stays needs_decision.` |
| Sent and recorded | false | `Task <id> is now validating. The pipeline got the owner-approved answer (...).` |

## Form

Renderer ID: `factoryman-decision-approval`.
Title: `Approve answer for task <id>`.
Payload and reply: see `data-model.md`.
Timeout: the `approvalTimeoutMinutes` setting.

The form shows the task, the key, the step and status (or the run's outcome), the findings, and "Answer that will be sent".
Buttons: Approve (hidden when the payload is unreadable), Deny, Cancel.
A comment box is optional.

## Driver additions (`ValidationDriver`)

```ts
current(taskId: string): Promise<{ ok: true; view: RunView } | { ok: false; message: string }>;
answer(taskId: string, response: Answer, actor: Actor, evidence?: string): Promise<AnswerResult>;
rerun(taskId: string, actor: Actor, evidence: string): Promise<AnswerResult>;
```

- `current` reads with `validator.status`, never writes, and does not need a state.
- `answer` keeps its behavior; a given `evidence` replaces the default text of `resolve`.
- `rerun` applies `resolve` only in `needs_decision`, and calls no validator operation.
- The loop still never answers a gate.

## Parking evidence

The `finding` event's evidence for a gate or a finished run ends with the line `Decision key: nm-...`.
Nothing else in it changes.

## Registration

`TOOL_NAMES` has six entries.
`toolsForMetadata({ role: "supervisor" })` returns five names, ending with `factoryman_decide`.
`toolsForMetadata({ role: "worker" })` returns `factoryman_report` only.

## Conformance

- `SUPERVISOR_TOOLS` in `tools/conformance/scenarios/helpers.ts` lists five names.
- S8 adds `S8.decide-wrong-state`: `factoryman_decide` on a `working` task returns an error that names `needs_decision`, writes no `resolve` row, and leaves the state `working`.
