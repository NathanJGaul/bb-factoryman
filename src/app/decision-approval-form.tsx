import { useId, useRef, useState, type ReactNode } from "react";
import type { PluginPendingInteractionProps } from "@get-bb/plugin-sdk/app";
import { answerFor, readDecisionPayload, type DecisionAnswer, type DecisionFinding, type DecisionRequestPayload } from "../approval/contract";

type Phase = "idle" | "sending" | "sent";

const BUTTON =
  "inline-flex h-9 cursor-pointer items-center justify-center whitespace-nowrap rounded-md px-4 text-sm font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50";
const PRIMARY = `${BUTTON} bg-foreground text-background hover:bg-foreground/90`;
const OUTLINE = `${BUTTON} border border-input bg-transparent hover:bg-state-hover hover:text-foreground`;
const GHOST = `${BUTTON} hover:bg-state-hover hover:text-foreground`;
const BLOCK = "col-span-2 m-0 min-w-0 whitespace-pre-wrap break-words rounded-md border border-border bg-card px-3 py-2";

function None() {
  return <span className="text-muted-foreground">None</span>;
}

/** The sentence that says what approval does. Every word of the answer comes from the payload, never from the validator's text. */
function sentence(answer: DecisionAnswer): string {
  switch (answer.action) {
    case "approve":
      return "Approve this step and continue the pipeline.";
    case "skip":
      return "Skip this step and continue the pipeline.";
    case "fix":
      return `Have the pipeline fix ${answer.findingIds.join(", ")}.`;
    case "rerun":
      return "Start a new no-mistakes run for this task. Nothing is sent to the run that finished.";
  }
}

function Finding({ finding }: { finding: DecisionFinding }) {
  return (
    <li className="flex flex-col gap-1 border-b border-border px-3 py-2 last:border-b-0">
      <span className="flex flex-wrap gap-x-3">
        <span className="font-mono">{finding.id}</span>
        <span className="text-muted-foreground">{finding.severity}</span>
        <span className="break-all font-mono text-muted-foreground">{finding.file}</span>
        <span className="text-muted-foreground">{finding.action}</span>
      </span>
      <span className="whitespace-pre-wrap break-words">{finding.description}</span>
    </li>
  );
}

function Findings({ findings }: { findings: DecisionFinding[] }): ReactNode {
  if (findings.length === 0) return <p className="m-0 text-muted-foreground">No findings are listed for this gate.</p>;
  return (
    <ul aria-label="Findings" className="m-0 max-h-64 list-none overflow-y-auto rounded-md border border-border bg-card p-0">
      {findings.map((finding, index) => (
        <Finding key={`${finding.id}-${index}`} finding={finding} />
      ))}
    </ul>
  );
}

function Request({ request }: { request: DecisionRequestPayload }) {
  const { answer } = request;
  return (
    <div className="flex flex-col gap-3">
      <dl className="m-0 grid grid-cols-[max-content_minmax(0,1fr)] gap-x-4 gap-y-2">
        <dt className="text-muted-foreground">Task</dt>
        <dd className="m-0 min-w-0 break-all font-mono">{request.taskId}</dd>
        <dt className="text-muted-foreground">Key</dt>
        <dd className="m-0 min-w-0 break-all font-mono">{request.key}</dd>
        {request.kind === "gate" ? (
          <>
            <dt className="text-muted-foreground">Step</dt>
            <dd className="m-0 min-w-0 break-all">{request.step}</dd>
            <dt className="text-muted-foreground">Status</dt>
            <dd className="m-0 min-w-0 break-all">{request.status}</dd>
          </>
        ) : (
          <>
            <dt className="text-muted-foreground">Outcome</dt>
            <dd className="m-0 min-w-0 break-all">{request.outcome}</dd>
          </>
        )}
      </dl>
      {request.kind === "gate" ? <Findings findings={request.findings} /> : null}
      <dl className="m-0 grid grid-cols-[max-content_minmax(0,1fr)] gap-x-4 gap-y-2">
        <dt className="col-span-2 text-muted-foreground">Answer that will be sent</dt>
        <dd className={BLOCK}>{sentence(answer)}</dd>
        {answer.action === "fix" ? (
          <>
            <dt className="text-muted-foreground">Findings to fix</dt>
            <dd className="m-0 min-w-0 break-all font-mono">{answer.findingIds.join(", ")}</dd>
            <dt className="text-muted-foreground">Instructions</dt>
            <dd className="m-0 min-w-0 whitespace-pre-wrap break-words">{answer.instructions === "" ? <None /> : answer.instructions}</dd>
          </>
        ) : null}
      </dl>
    </div>
  );
}

function Expiry({ at }: { at: number }) {
  const date = new Date(at);
  return (
    <p className="m-0 text-xs text-muted-foreground">
      Expires <time dateTime={date.toISOString()}>{date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</time>
    </p>
  );
}

/**
 * The body of the decision form: what the pipeline stopped on, the exact answer that will be sent, an optional comment,
 * and the owner's decision. The form fails closed: a payload it cannot read, or one that contradicts itself, gets no Approve button.
 * Every string is a React text node, so text that came from the validator cannot add markup.
 */
export function DecisionApprovalForm({ interaction, submit, cancel }: PluginPendingInteractionProps) {
  const request = readDecisionPayload(interaction.payload);
  const [comment, setComment] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [failure, setFailure] = useState<string | null>(null);
  const inFlight = useRef(false);
  const commentId = useId();
  const busy = phase !== "idle";

  async function run(action: () => Promise<void>) {
    if (inFlight.current) return;
    inFlight.current = true;
    setFailure(null);
    setPhase("sending");
    try {
      await action();
      setPhase("sent");
    } catch (error) {
      inFlight.current = false;
      setFailure(error instanceof Error ? error.message : String(error));
      setPhase("idle");
    }
  }

  return (
    <div role="group" aria-label="Decision approval request" aria-busy={phase === "sending"} className="flex flex-col gap-4 text-sm">
      {request === null ? (
        <p role="alert" className="m-0 rounded-md border border-destructive px-3 py-2 text-destructive">
          This approval request is unreadable, so Approve is not offered. Deny it or cancel it.
        </p>
      ) : (
        <Request request={request} />
      )}
      <div className="flex flex-col gap-1.5">
        <label htmlFor={commentId} className="text-muted-foreground">
          Comment (optional)
        </label>
        <textarea
          id={commentId}
          rows={3}
          value={comment}
          disabled={busy}
          onChange={(event) => setComment(event.target.value)}
          className="w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
        />
      </div>
      {failure === null ? null : (
        <p role="alert" className="m-0 text-destructive">
          Your answer was not sent: {failure}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {request === null ? null : (
          <button type="button" className={PRIMARY} disabled={busy} onClick={() => void run(() => submit(answerFor("approved", comment)))}>
            Approve
          </button>
        )}
        <button type="button" className={OUTLINE} disabled={busy} onClick={() => void run(() => submit(answerFor("denied", comment)))}>
          Deny
        </button>
        <button type="button" className={GHOST} disabled={busy} onClick={() => void run(cancel)}>
          Cancel
        </button>
      </div>
      {interaction.expiresAt === null ? null : <Expiry at={interaction.expiresAt} />}
    </div>
  );
}
