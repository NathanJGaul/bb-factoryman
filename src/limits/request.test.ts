import { describe, expect, it } from "vitest";
import { decodeRequest, encodeRequest, type QueuedRequest } from "./request";

const REQUEST: QueuedRequest = {
  v: 1,
  description: "Add a --json flag.",
  tags: ["docs"],
  profile: { provider: "claude", model: "opus", reasoningLevel: "high", permissionMode: "auto" },
  machine: "host_gpu",
  cloneHost: "host_local",
  parentThreadId: "thr-sup",
  branchPrefix: "wip/",
  baseBranch: null,
};

describe("queued request", () => {
  it("[U1003] encodes to plain JSON data and decodes back to an equal value", () => {
    const encoded = encodeRequest(REQUEST);
    expect(JSON.parse(JSON.stringify(encoded))).toEqual(encoded);
    expect(decodeRequest(JSON.parse(JSON.stringify(encoded)))).toEqual({ ok: true, request: REQUEST });
    const bare = { ...REQUEST, machine: null, cloneHost: null, branchPrefix: null, tags: [] };
    expect(decodeRequest(encodeRequest(bare))).toEqual({ ok: true, request: bare });
  });

  it.each([
    ["text", "not json"],
    ["null", null],
    ["an array", []],
    ["the wrong version", { ...REQUEST, v: 2 }],
    ["a missing description", { ...REQUEST, description: undefined }],
    ["a blank description", { ...REQUEST, description: "  " }],
    ["a missing profile field", { ...REQUEST, profile: { provider: "claude" } }],
    ["an unknown field", { ...REQUEST, extra: 1 }],
    ["a missing parent thread", { ...REQUEST, parentThreadId: undefined }],
    ["a bad permission mode", { ...REQUEST, profile: { ...REQUEST.profile, permissionMode: "yolo" } }],
  ])("[U1004] rejects %s", (_label, raw) => {
    const result = decodeRequest(raw);
    expect(result.ok).toBe(false);
    expect(result.ok ? "" : result.message.length).toBeGreaterThan(0);
  });
});
