import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// A path string, not a URL object: under jsdom the global URL class is not Node's, and fs rejects it.
const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "skills");

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
      const text = readFileSync(join(root, entry.name, "SKILL.md"), "utf8");
      const name = /^---\n(?:[\s\S]*?\n)?name:[ \t]*(.+?)[ \t]*\n/.exec(text)?.[1];
      if (name === undefined) throw new Error(`skills/${entry.name}/SKILL.md has no name in its front matter`);
      return name;
    })
    .sort();
}
