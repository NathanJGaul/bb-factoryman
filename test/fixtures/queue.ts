import type { Profile } from "../../src/machine/types";

/** A profile that the fake port's default providers accept. */
export const PROFILE_OK_FOR_QUEUE: Profile = { provider: "claude", model: "opus", reasoningLevel: "high", permissionMode: "accept-edits" };
