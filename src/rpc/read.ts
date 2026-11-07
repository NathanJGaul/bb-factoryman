import type { BbPluginApi } from "@get-bb/plugin-sdk";
import type { Store } from "../store/store";

export const RPC_VERSION = 1;

export function registerReadRpc(_bb: Pick<BbPluginApi, "rpc">, _store: Store): void {
  // Not implemented.
}
