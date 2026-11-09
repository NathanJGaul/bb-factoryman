/**
 * What a harness tells its model, apart from the task: the system text, the system reminders that Claude Code
 * puts in a user message, and the `<system_instructions>` block that bb prepends to the prompt of an ACP agent.
 * The task text is left out, because it names the plugin's tools and skills too.
 */
const BLOCKS = /<(system-reminder|system_instructions)>[\s\S]*?<\/\1>/g;

export function instructionText(system: string, userTexts: string[]): string {
  const blocks = userTexts.flatMap((text) => text.match(BLOCKS) ?? []);
  return [system, ...blocks].join("\n");
}

/** The plugin tools named by a route that only the harness uses: bb's MCP bridge name, or an `xd://` device. */
export function pluginToolsIn(text: string): string[] {
  const names = [...text.matchAll(/mcp__bb-bridge__(factoryman_[a-z]+)|xd:\/\/mcp__bb_bridge_(factoryman_[a-z]+)/g)].map((m) => (m[1] ?? m[2]) as string);
  return [...new Set(names)].sort();
}

export function skillsIn(text: string): string[] {
  return [...new Set(text.match(/factoryman-(?:worker|supervisor)/g) ?? [])].sort();
}
