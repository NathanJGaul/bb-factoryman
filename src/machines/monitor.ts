import type { Runtime } from "../runtime";

/** The start of the evidence on a block that the monitor wrote. The monitor unblocks only blocks that start with it. */
export const MACHINE_OFFLINE = "machine offline: ";

export class MachineMonitor {
  constructor(private readonly rt: Runtime) {
    void this.rt;
  }

  async tick(): Promise<void> {
    // Not implemented.
  }

  async hostDeleted(_hostId: string, _name: string): Promise<void> {
    // Not implemented.
  }
}
