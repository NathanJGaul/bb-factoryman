/** The most characters of a provider's cause that the evidence and the wake message carry. */
export const CAUSE_LIMIT = 300;

const MODEL_REMEDY = "Pick a model that `bb provider models <provider>` lists for this provider, then dispatch the task again.";
const SIGN_IN_REMEDY = "Sign in to the provider on the machine that runs the worker, then dispatch the task again.";

// The patterns are advisory: they only add a hint line, and a miss costs the hint and nothing else (D-107).
const NO_MODEL = [/\bno model selected\b/i, /\bfailed to resolve\b.*\bmodel\b/i];
const NOT_SIGNED_IN = [/\bnot logged in\b/i, /\bplease run \/login\b/i, /\bunauthenticated\b/i, /\bunauthorized\b/i];

/**
 * The provider's cause as a safe line of text: control characters and line breaks become single spaces, repeated
 * spaces collapse, and the text is cut to `CAUSE_LIMIT` characters. The cause is data that a provider reported.
 */
export function boundCause(text: string): string {
  const flat = text.replace(/\p{Cc}+/gu, " ").replace(/ {2,}/g, " ").trim();
  return flat.length <= CAUSE_LIMIT ? flat : `${flat.slice(0, CAUSE_LIMIT - 3)}...`;
}

/**
 * A hint for the owner when the cause means "not signed in" or "no model", or null. The model check comes first:
 * a no-model cause often also says "/login" and "API key" and is still a model problem. The hint never replaces the cause.
 */
export function remedyFor(input: { cause: string; category: string | null; status: number | null }): string | null {
  const { cause, category, status } = input;
  if (NO_MODEL.some((pattern) => pattern.test(cause))) return MODEL_REMEDY;
  if (NOT_SIGNED_IN.some((pattern) => pattern.test(cause)) || status === 401 || category === "unauthorized") return SIGN_IN_REMEDY;
  return null;
}
