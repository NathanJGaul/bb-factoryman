import { useId, useRef, useState, type ReactNode } from "react";
import { UrlLink, type PluginPendingInteractionProps } from "@get-bb/plugin-sdk/app";
import { answerFor, readMergePayload, type MergeRequestPayload } from "../approval/contract";

type Phase = "idle" | "sending" | "sent";

const BUTTON =
  "inline-flex h-9 cursor-pointer items-center justify-center whitespace-nowrap rounded-md px-4 text-sm font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50";
const PRIMARY = `${BUTTON} bg-foreground text-background hover:bg-foreground/90`;
const OUTLINE = `${BUTTON} border border-input bg-transparent hover:bg-state-hover hover:text-foreground`;
const GHOST = `${BUTTON} hover:bg-state-hover hover:text-foreground`;

/** Only an http or https URL becomes a link. Anything else (javascript:, data:, a bare word) stays text. */
function isWebUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

function None() {
  return <span className="text-muted-foreground">None</span>;
}

function PullRequest({ url }: { url: string }): ReactNode {
  if (url === "") return <None />;
  return isWebUrl(url) ? <UrlLink href={url}>{url}</UrlLink> : url;
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
        <PullRequest url={request.prUrl} />
      </dd>
      <dt className="col-span-2 text-muted-foreground">Evidence</dt>
      <dd className="col-span-2 m-0 max-h-64 min-w-0 overflow-y-auto whitespace-pre-wrap break-words rounded-md border border-border bg-card px-3 py-2">
        {request.evidence === "" ? <None /> : request.evidence}
      </dd>
    </dl>
  );
}

function Expiry({ at }: { at: number }) {
  const date = new Date(at);
  return (
    <p className="m-0 text-muted-foreground">
      Expires <time dateTime={date.toISOString()}>{date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</time>
    </p>
  );
}

/**
 * The body of the merge approval form: the request, an optional comment, and the owner's decision.
 * The form fails closed: a request it cannot read gets no Approve button.
 */
export function MergeApprovalForm({ interaction, submit, cancel }: PluginPendingInteractionProps) {
  const request = readMergePayload(interaction.payload);
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
    <div role="group" aria-label="Merge approval request" aria-busy={phase === "sending"} className="flex flex-col gap-4 text-sm">
      {request === null ? (
        <p role="alert" className="m-0 rounded-md border border-destructive px-3 py-2 text-destructive">
          This approval request is unreadable, so Approve is not offered. Deny it or cancel it.
        </p>
      ) : (
        <Request request={request} />
      )}
      {interaction.expiresAt === null ? null : <Expiry at={interaction.expiresAt} />}
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
    </div>
  );
}
