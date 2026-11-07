import type { DeliveryMode, TaskKind } from "../machine/types";

export interface PromptInput {
  taskId: string;
  kind: TaskKind;
  mode: DeliveryMode;
  branch: string;
  description: string;
}

const HANDOFF: Record<DeliveryMode, string> = {
  "no-mistakes":
    "Commit your work on the branch and then call factoryman_report with outcome \"done\" and your evidence. " +
    "Never push to origin. The plugin runs the no-mistakes pipeline for you.",
  "direct-PR":
    "Commit your work, push the branch, and open a pull request. " +
    "Then call factoryman_report with outcome \"done\", your evidence, and the pull request URL as prUrl.",
  "local-only":
    "Commit your work on the branch. " +
    "Then call factoryman_report with outcome \"done\", your evidence, and the number of commits you landed as landedCommits.",
};

/** The first message a worker reads. The worker skill (milestone 11) will add detail. */
export function buildWorkerPrompt(input: PromptInput): string {
  const lines = [
    `You are the worker for ${input.kind} task ${input.taskId}. The delivery mode is ${input.mode}.`,
    "",
    "Task:",
    input.description,
    "",
    `First, create and switch to the branch ${input.branch}.`,
  ];
  if (input.kind === "scout") {
    lines.push(
      "This is a scout task. Investigate and write your findings. Do not change project files.",
      "When you are done, call factoryman_report with outcome \"done\" and your full report as evidence.",
    );
  } else {
    lines.push(HANDOFF[input.mode]);
  }
  lines.push(
    "If you are blocked, call factoryman_report with outcome \"blocked\" and say why.",
    "If you cannot finish, call factoryman_report with outcome \"failed\" and say why.",
    "Do not contact the owner. Report only through factoryman_report.",
  );
  return lines.join("\n");
}
