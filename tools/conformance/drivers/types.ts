export type PermissionMode = "accept-edits" | "auto" | "full";

/** The profile that `factoryman_dispatch` takes. */
export interface Profile {
  provider: string;
  model: string;
  reasoningLevel: string;
  permissionMode: PermissionMode;
}

/** How the harness shows the report tool to its model. */
export type ToolRoute = "mcp-stdio" | "function" | "mcp-deferred" | "xd-device";

/** The request format that the harness sends to its model endpoint. */
export type Wire = "none" | "chat" | "responses" | "messages";

/** A file to write under the lab home. The path is relative to the home. */
export interface HomeFile {
  path: string;
  content: string;
}

export type BindResult =
  | { ok: true; /** Paths to bind read-only into the sandbox. */ binds: string[]; /** Names to link into the lab's bin directory. */ links: Array<{ name: string; target: string }> }
  | { ok: false; message: string };

export interface Driver {
  /** `stub` or a harness id. */
  id: string;
  title: string;
  /** The bb provider id. */
  provider: string;
  wire: Wire;
  toolRoute: ToolRoute;
  /** The profile for scout tasks and for the S2 and S3 checks. */
  profile: Profile;
  /** The profile for ship tasks. It may differ in permission mode, so a scripted shell is not stalled by a prompt. */
  shipProfile: Profile;
  /** A profile that bb must refuse before it spawns anything (S2). */
  unsupportedProfile: Profile;
  /**
   * The failure that the fake model plays for S7: the HTTP status, how long the harness may take to give up, and what the harness does with it.
   * `fails` means bb records a failed thread. `ends-turn` means the harness shows the error as the assistant's text and ends the turn normally.
   */
  failure: { code: number; timeoutMs: number; mode: "fails" | "ends-turn" };
  /** What a late supervisor stamp needs before the tools and the skill appear (S9). */
  roleChangeStep: "next-turn" | "clear";
  /** The command-line tool this driver runs, or null for the stub. */
  cli: { command: string; versionArgs: string[] } | null;
  /** The files to write under the lab home so the CLI talks to the fake model on this loopback port. */
  homeFiles(modelPort: number): HomeFile[];
  /** Commands to run in the lab after the files are written. */
  setupCommands(modelPort: number): string[][];
  /** Resolve the CLI on this machine. `which` returns the real path of a command, or null. */
  bindCli(which: (command: string) => string | null): BindResult;
}
