import { readdirSync, readFileSync } from "node:fs";

const root = new URL("../../skills/", import.meta.url);

/**
 * The skill names that the plugin ships, read from the front matter of each
 * `skills/<dir>/SKILL.md`. The fake host takes these as the manifest's skill
 * roots, so a name that `configure` selects but no file declares fails the
 * same way it does in bb: the plugin's whole selection, tools included, is
 * rejected.
 */
export function skillNamesOnDisk(): string[] {
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const text = readFileSync(new URL(`${entry.name}/SKILL.md`, root), "utf8");
      const name = /^---\n(?:[\s\S]*?\n)?name:[ \t]*(.+?)[ \t]*\n/.exec(text)?.[1];
      if (name === undefined) throw new Error(`skills/${entry.name}/SKILL.md has no name in its front matter`);
      return name;
    })
    .sort();
}
