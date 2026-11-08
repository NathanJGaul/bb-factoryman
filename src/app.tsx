import { definePluginApp } from "@get-bb/plugin-sdk/app";
import { MergeApprovalForm } from "./app/merge-approval-form";
import { MERGE_RENDERER_ID } from "./approval/contract";

/** The frontend entry. bb loads the bundle that `bb plugin build` makes from this file. */
export default definePluginApp((app) => {
  app.slots.pendingInteraction({ id: MERGE_RENDERER_ID, component: MergeApprovalForm });
});
