import { useId, useRef, useState } from "react";
import { UrlLink, type PluginPendingInteractionProps } from "@get-bb/plugin-sdk/app";
import { answerFor, readMergePayload, type MergeRequestPayload } from "../approval/contract";

type Phase = "idle" | "sending" | "sent";

const BUTTON =
  "inline-flex h-9 cursor-pointer items-center justify-center whitespace-nowrap rounded-md px-4 text-sm font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50";
const PRIMARY = `${BUTTON} bg-foreground text-background hover:bg-foreground/90`;
const OUTLINE = `${BUTTON} border border-input bg-transparent hover:bg-state-hover hover:text-foreground`;
const GHOST = `${BUTTON} hover:bg-state-hover hover:text-foreground`;

function None() {
  return <span className="text-muted-foreground">None</span>;
}

function Request({ request }: { request: MergeRequestPayload }) {
  return (
    <dl className="m-0 grid grid-cols-[max-content_minmax(0,1fr)] gap-x-4 gap-y-2">
      <dt className="text-muted-foreground">Task</dt>
      <dd className="m-0 min-w-0 break-all font-mono">{request.taskId}</dd>
      <dt className="text-muted-foreground">Branch</dt>
      <dd className="m-0 min-w-0 break-all font-mono">{request.branch}</dd>
      <dt className="text-muted-foreground">Pull request</dt>
      <dd className="m-0 min-w-0 break-all">
        {request.prUrl === "" ? <None /> : <UrlLink href={request.prUrl}>{request.prUrl}</UrlLink>}
      </dd>
      <dt className="col-span-2 text-muted-foreground">Evidence</dt>
      <dd className="col-span-2 m-0 max-h-64 min-w-0 overflow-y-auto whitespace-pre-wrap break-words rounded-md border border-border bg-card px-3 py-2">
        {request.evidence === "" ? <None /> : request.evidence}
      </dd>
    </dl>
  );
}

/** The body of the merge approval form: the request, an optional comment, and the owner's decision. */
export function MergeApprovalForm({ interaction, submit, cancel }: PluginPendingInteractionProps) {
  const request = readMergePayload(interaction.payload);
  const [comment, setComment] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const inFlight = useRef(false);
  const commentId = useId();
  const busy = phase !== "idle";

  async function run(action: () => Promise<void>) {
    if (inFlight.current) return;
    inFlight.current = true;
    setPhase("sending");
    await action();
    setPhase("sent");
  }

  if (request === null) return null;
  return (
    <div role="group" aria-label="Merge approval request" aria-busy={phase === "sending"} className="flex flex-col gap-4 text-sm">
      <Request request={request} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor={commentId} className="font-medium">
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
      <div className="flex flex-wrap gap-2">
        <button type="button" className={PRIMARY} disabled={busy} onClick={() => void run(() => submit(answerFor("approved", comment)))}>
          Approve
        </button>
        <button type="button" className={OUTLINE} disabled={busy} onClick={() => void run(() => submit(answerFor("denied", comment)))}>
          Deny
        </button>
        <button type="button" className={GHOST} disabled={busy} onClick={() => void run(cancel)}>
          Cancel
        </button>
      </div>
    </div>
  );
}
