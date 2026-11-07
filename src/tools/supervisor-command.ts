import { errorText, type Runtime } from "../runtime";
import { identify } from "./access";

export interface CommandResult {
  exitCode: number;
  stdout?: string;
  stderr?: string;
}

const USAGE = "Usage: bb factoryman supervisor <thread-id>\n";

/**
 * `bb factoryman supervisor <thread-id>` stamps the supervisor role on a
 * thread, so bb offers it the four supervisor tools. The stamp only chooses
 * which tools bb offers. Each tool still decides the caller from the store.
 */
export async function runFactorymanCommand(rt: Runtime, argv: string[]): Promise<CommandResult> {
  const [command, threadId, ...rest] = argv;
  if (command !== "supervisor" || threadId === undefined || threadId.trim() === "" || rest.length > 0) {
    return { exitCode: 2, stderr: USAGE };
  }
  if (identify(rt.deps.store, threadId).role === "worker") {
    return { exitCode: 1, stderr: `Thread ${threadId} is a task worker, so it cannot be a supervisor.\n` };
  }
  try {
    await rt.deps.bb.setThreadMetadata(threadId, { role: "supervisor" });
  } catch (error) {
    return { exitCode: 1, stderr: `Could not stamp thread ${threadId}: ${errorText(error)}\n` };
  }
  return { exitCode: 0, stdout: `Thread ${threadId} is now a factoryman supervisor. It sees the four supervisor tools from its next session.\n` };
}
