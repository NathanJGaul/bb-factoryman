import type { BbPluginApi } from "@get-bb/plugin-sdk";

/**
 * Plugin factory. It registers nothing until the tools and event wiring
 * milestones land. Today it only announces that the plugin loaded.
 */
export default function plugin(bb: BbPluginApi): void {
  bb.log.info("bb-factoryman loaded");
}
