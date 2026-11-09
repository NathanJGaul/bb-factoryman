import type { ExecResult } from "../../src/exec";
import { READ_SCRIPT } from "../../src/validator/agent";

/** True for the one command that the validator observation runs: `sh -c <READ_SCRIPT>`. */
export const isRead = (command: string, args: readonly string[]): boolean => command === "sh" && args[1] === READ_SCRIPT;

/** What a scripted read answers: the text of the configuration file, or a failure. */
export type ReadAnswer = string | { code: number | null; stderr: string };

export function readResult(answer: ReadAnswer): ExecResult {
  return typeof answer === "string" ? { code: 0, stdout: answer, stderr: "" } : { code: answer.code, stdout: "", stderr: answer.stderr };
}

/** An exec handler that answers the validator read with `answer` and lets every other command succeed with no output. */
export function answerRead(answer: ReadAnswer): (command: string, args: readonly string[]) => ExecResult {
  return (command, args) => (isRead(command, args) ? readResult(answer) : { code: 0, stdout: "", stderr: "" });
}
