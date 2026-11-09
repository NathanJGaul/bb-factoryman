export interface IsolationVerdict {
  clean: boolean;
  /** What changed, in the words of the diff. */
  changes: string[];
  /** Churn from other tools on the machine that the check ignored. */
  ignored: number;
}

/**
 * The places where a harness, bb, or a git or ssh tool would write if the lab leaked into the real home.
 * Other tools on a shared machine write elsewhere all the time (for example `opencode.db`), and that churn is not a leak.
 */
const SENSITIVE = /\/\.(pi|omp|codex|claude|ssh|bb)(\/|$)|\/\.bb-machines\/(?![^ ]*\/logs\/)|\/\.config\/(gh|git|systemd|bb|omp|pi)(\/|$)|bblab/;

function sections(diff: string): Array<{ title: string; lines: string[] }> {
  return diff
    .split(/^== /m)
    .filter((section) => section.trim() !== "")
    .map((section) => {
      const [title = "", ...lines] = section.split("\n");
      return { title, lines };
    });
}

const changed = (lines: string[]) => lines.filter((line) => /^[<>] /.test(line));

/**
 * Read the output of `bblab-evidence diff` and decide whether the run left the real machine unchanged.
 * A run is unclean for a leak line, for a change to a credential or git config file, or for a changed file name
 * in a place where a harness or bb would write.
 */
export function judgeIsolation(diff: string): IsolationVerdict {
  const changes: string[] = diff.split("\n").filter((line) => line.startsWith("LEAK"));
  let ignored = 0;
  for (const { title, lines } of sections(diff)) {
    if (title.startsWith("credential + git config stat")) {
      changes.push(...changed(lines).map((line) => `credential or git config: ${line}`));
    } else if (title.startsWith("real-home file NAMES")) {
      for (const line of changed(lines)) {
        if (SENSITIVE.test(line)) changes.push(`real-home file name: ${line}`);
        else ignored += 1;
      }
    }
  }
  return { clean: changes.length === 0, changes, ignored };
}
