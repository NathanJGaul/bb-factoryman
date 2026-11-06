# Contract: transition function

Module: `src/machine/transition.ts`.
No bb imports.

```ts
function createTask(raw: unknown): CreateResult;
function transition(snapshot: TaskSnapshot, raw: unknown): TransitionResult;

type CreateResult =
  | { ok: true; snapshot: TaskSnapshot }
  | { ok: false; refusal: Refusal };

type TransitionResult =
  | { ok: true; snapshot: TaskSnapshot; from: TaskState; to: TaskState; event: ParsedEvent }
  | { ok: false; refusal: Refusal };
```

## Guarantees

1. **Pure.** The same snapshot and event always return a deeply equal result. The function reads no clock, file, network, or global.
2. **No throw.** Any input, including `undefined` and non-objects, returns a result. Errors become refusals.
3. **No mutation.** The input snapshot is never changed. A returned snapshot is a new object.
4. **Fail closed.** A refusal returns no snapshot, so the caller cannot continue from a half-applied state.
5. **Complete.** Each state and event pair outside the table in `data-model.md` returns `illegal_transition`.
6. **Stable reasons.** `refusal.code` comes from the closed list in `data-model.md`. `refusal.message` is for people and may change.
7. **Order.** Validation runs first (`invalid_event`, `unknown_event`), then table lookup (`illegal_transition`), then guards in table order.

## Examples

```text
transition({ state: 'awaiting_approval', context: shipContext }, { type: 'merge', actor: 'supervisor', yolo: false })
  -> { ok: false, refusal: { code: 'approval_required', ... } }

transition({ state: 'awaiting_approval', context: shipContext }, { type: 'merge', actor: 'supervisor', yolo: true })
  -> { ok: true, snapshot: { state: 'merged', ... }, from: 'awaiting_approval', to: 'merged', ... }
```
