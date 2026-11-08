/** Small Markdown helpers for tests that read the skills and the runbook as structure, not as a bag of words. */

export interface Fence {
  lang: string;
  code: string;
}

/** The text under a heading, up to the next heading of the same or a higher level. Subsections stay in. */
export function section(text: string, headingStart: string): string {
  const lines = text.split("\n");
  const start = lines.findIndex((line) => line.startsWith(headingStart));
  if (start === -1) throw new Error(`no heading starts with ${JSON.stringify(headingStart)}`);
  const level = (lines[start] as string).match(/^#+/)?.[0].length ?? 0;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    const hashes = (lines[i] as string).match(/^(#+) /)?.[1];
    if (hashes !== undefined && hashes.length <= level) {
      end = i;
      break;
    }
  }
  return lines.slice(start + 1, end).join("\n");
}

/** Every heading line, in order. */
export function headings(text: string): string[] {
  return text.split("\n").filter((line) => /^#{1,6} /.test(line));
}

export function fences(text: string): Fence[] {
  return [...text.matchAll(/^```([a-z]*)\n([\s\S]*?)^```$/gm)].map((match) => ({ lang: match[1] as string, code: match[2] as string }));
}

/** The text with every fenced block removed. */
export function prose(text: string): string {
  return text.replace(/^```[a-z]*\n[\s\S]*?^```$/gm, "");
}

/** Join backslash continuations, drop comments and blank lines, and trim. */
export function logicalLines(code: string): string[] {
  const joined = code.replace(/\\\n\s*/g, " ");
  return joined
    .split("\n")
    .map((line) => line.replace(/\s+#.*$/, "").trim())
    .filter((line) => line !== "" && !line.startsWith("#"));
}

/** Sentences of prose: one per line in these files, and a line can still hold more than one. */
export function sentences(text: string): string[] {
  return text
    .split("\n")
    .flatMap((line) => line.split(/(?<=[.!?])\s+(?=[A-Z`*])/))
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence !== "");
}

/** Rows of the first Markdown table in the text, as arrays of trimmed cells. The header and separator rows are dropped. */
export function tableRows(text: string): string[][] {
  const rows = text
    .split("\n")
    .filter((line) => line.startsWith("|"))
    .map((line) => line.replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim()));
  return rows.slice(2);
}

/** Backticked tokens in the text. */
export function ticks(text: string): string[] {
  return [...text.matchAll(/`([^`\n]+)`/g)].map((match) => match[1] as string);
}
