import { describe, expect, it } from "vitest";
import { boundCause, remedyFor } from "./failure-cause";

// The four causes that the scout report saw (section 5.1), word for word.
const CLAUDE_LOGIN = "Not logged in · Please run /login";
const OMP_NO_MODEL = "Internal error: No model selected. Use /login, set an API key, or pick a model with --model";
const PI_MODEL = "Failed to resolve Pi model openai/gpt-6-luna";
const CODEX_401 = "unexpected status 401 Unauthorized: Missing bearer or basic authentication in header";

const MODEL_REMEDY = "Pick a model that `bb provider models <provider>` lists for this provider, then dispatch the task again.";
const SIGN_IN_REMEDY = "Sign in to the provider on the machine that runs the worker, then dispatch the task again.";
const remedy = (cause: string, category: string | null = null, status: number | null = null) => remedyFor({ cause, category, status });

describe("boundCause", () => {
  it.each([CLAUDE_LOGIN, OMP_NO_MODEL, PI_MODEL, CODEX_401])("[U1445] leaves the cause %j unchanged", (cause) => {
    expect(boundCause(cause)).toBe(cause);
  });

  it("[U1446] replaces a line break with one space", () => {
    expect(boundCause("first\r\n\r\nsecond")).toBe("first second");
  });

  it("[U1446] replaces a tab with one space", () => {
    expect(boundCause("first\tsecond")).toBe("first second");
  });

  it("[U1446] replaces other control characters, the escape character and the delete character among them, with one space", () => {
    expect(boundCause("first\u0000\u001bsecond\u007fthird")).toBe("first second third");
  });

  it("[U1446] collapses repeated spaces", () => {
    expect(boundCause("first    second")).toBe("first second");
  });

  it("[U1446] trims the ends", () => {
    expect(boundCause("   first second \n")).toBe("first second");
  });

  it("[U1447] leaves a text of exactly 300 characters unchanged", () => {
    const exact = "x".repeat(300);
    expect(boundCause(exact)).toBe(exact);
  });

  it("[U1448] cuts a text of 301 characters to 300, ending with three dots", () => {
    const cut = boundCause("x".repeat(301));
    expect(cut).toHaveLength(300);
    expect(cut).toBe(`${"x".repeat(297)}...`);
  });
});

describe("remedyFor", () => {
  it("[U1449] gives the model remedy for No model selected", () => {
    expect(remedy("No model selected")).toBe(MODEL_REMEDY);
  });

  it("[U1450] gives the model remedy for Failed to resolve Pi model", () => {
    expect(remedy(PI_MODEL)).toBe(MODEL_REMEDY);
  });

  it("[U1449] gives the model remedy for the omp text, which also mentions /login and an API key", () => {
    expect(remedy(OMP_NO_MODEL)).toBe(MODEL_REMEDY);
  });

  it("[U1451] gives the model remedy when a cause matches both the model family and the sign-in family", () => {
    expect(remedy("No model selected. Not logged in · Please run /login")).toBe(MODEL_REMEDY);
  });

  it("[U1452] gives the sign-in remedy for a login prompt and for an Unauthorized text", () => {
    expect(remedy(CLAUDE_LOGIN)).toBe(SIGN_IN_REMEDY);
    expect(remedy(CODEX_401)).toBe(SIGN_IN_REMEDY);
  });

  it("[U1453] gives the sign-in remedy for HTTP 401 with unrelated text", () => {
    expect(remedy("connection reset by peer", "connection-failed", 401)).toBe(SIGN_IN_REMEDY);
  });

  it("[U1454] gives the sign-in remedy for the category unauthorized", () => {
    expect(remedy("request rejected", "unauthorized")).toBe(SIGN_IN_REMEDY);
  });

  it("[U1455] gives nothing for unrelated text with status 500 and another category", () => {
    expect(remedy("The provider returned an internal error", "internal", 500)).toBeNull();
    expect(remedy("", null, null)).toBeNull();
  });
});
