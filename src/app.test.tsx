// @vitest-environment jsdom
import { loadPluginApp } from "@get-bb/plugin-sdk/testing/app";
import { describe, expect, it } from "vitest";
import { DECISION_RENDERER_ID, MERGE_RENDERER_ID } from "./approval/contract";
import { DecisionApprovalForm } from "./app/decision-approval-form";
import { MergeApprovalForm } from "./app/merge-approval-form";

describe("the frontend entry", () => {
  it("[U1833] registers the merge renderer and the decision renderer, each under its id with its own component", async () => {
    const app = await loadPluginApp(() => import("./app"));
    expect(app.pendingInteractions.map((registration) => [registration.id, registration.component])).toEqual([
      [MERGE_RENDERER_ID, MergeApprovalForm],
      [DECISION_RENDERER_ID, DecisionApprovalForm],
    ]);
  });
});
