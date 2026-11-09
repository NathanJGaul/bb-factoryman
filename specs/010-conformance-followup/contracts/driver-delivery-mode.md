# Contract: the driver's delivery mode

## Driver interface

```ts
export type DeliveryMode = "local-only" | "direct-PR" | "no-mistakes";

export interface Driver {
  // ...existing fields...
  /** The delivery mode of the lab project. Absent means `local-only`. */
  deliveryMode?: DeliveryMode;
}
```

## Runner

- `openRealLab` writes `project_config.delivery_mode` from `driver.deliveryMode ?? "local-only"`.
- A pure helper returns the SQL parameters, so a unit test can check them without a lab.

## Scenario S4

| Mode | Dispatch | Pass when |
| --- | --- | --- |
| `local-only` | `dispatch("ship", ...)` with no flag | one commit on `fm/<task>`, state `review_ready`, one wake |
| `direct-PR` | `dispatch("ship", ..., { flag: "pr=https://github.com/conformance/lab/pull/1" })` | the same three facts, and the task row carries the pull request URL |
| `no-mistakes` | not used by any driver today | S4 reports a failed check that says the mode is not supported by S4 |

A passing `S4.review-ready` in a mode other than `local-only` carries this note:
`This harness ran in <mode> mode, because the plugin does not admit it in local-only mode.`

## Fake lab

- The task's mode comes from the driver.
- A dispatch of a harness whose contract refuses the mode is blocked with `provider_not_admitted`, so a driver that names a refused mode fails the same way as in a real lab.
- A ship task reaches `review_ready` in `direct-PR` only when the flag carries a pull request URL, and in `local-only` only when it commits.
