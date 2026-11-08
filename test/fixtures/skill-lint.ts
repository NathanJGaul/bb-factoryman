import { sentences } from "./markdown";

const NEGATION = /\b(never|do not|don't|cannot|can't|must not|the plugin (?:blocks|refuses)|no one|not allowed)\b/i;

/** Instructions that would tell an agent to get around a gate. A sentence that matches one needs a negation. */
const FORBIDDEN: Array<{ name: string; pattern: RegExp; only?: "worker" | "supervisor" }> = [
  { name: "set the yolo flag", pattern: /\b(set|turn on|turn off|enable|flip|change|use)\b[^.]*\byolo\b/i },
  { name: "retry weaker", pattern: /\b(weaker|lower(?:ing|s)? the reasoning|lower(?:ing)? the permission)/i },
  { name: "another machine", pattern: /\b(another|a different|other) machine\b/i },
  { name: "approve for the owner", pattern: /\bapprove[^.]*\b(yourself|on (?:the )?owner's behalf)\b|\brecord (?:an|the) approval\b/i },
  { name: "force or bypass", pattern: /--force|\bforce\b|\bbypass|work(?:ing)? around|get(?:ting)? around|skip(?:ping)? (?:a|the|any) (?:check|gate)/i },
  { name: "push to origin", pattern: /\bpush(?:es)?(?: the branch| it| your work)? to `?origin/i },
  { name: "call a merge done early", pattern: /\b(?:describe|tell|say|report)\b[^.]*\bmerge\b[^.]*\bdone\b/i },
  { name: "contact the owner", pattern: /\b(?:message|contact|email|notify|ask)\b[^.]*\bthe owner\b/i, only: "worker" },
];

/**
 * Sentences that match a forbidden instruction and carry no negation. A skill
 * can mention each of these ideas only to forbid them. Returns one string per
 * violation, so a test failure names the sentence and the rule.
 */
export function gateViolations(text: string, role: "worker" | "supervisor"): string[] {
  const found: string[] = [];
  for (const sentence of sentences(text)) {
    for (const rule of FORBIDDEN) {
      if (rule.only !== undefined && rule.only !== role) continue;
      if (rule.pattern.test(sentence) && !NEGATION.test(sentence)) found.push(`${rule.name}: ${sentence}`);
    }
  }
  return found;
}
