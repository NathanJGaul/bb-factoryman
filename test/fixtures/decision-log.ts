export interface DuplicateHeading {
  /** The decision number, for example `D-105`. */
  number: string;
  /** The 1-based line of each heading that carries the number. */
  lines: number[];
}

export interface TextFile {
  path: string;
  text: string;
}

export interface DanglingCitation {
  path: string;
  line: number;
  number: string;
}

const HEADING = /^### (D-\d{3})\b/;
const CITATION = /\bD-\d{3}\b/g;

/** The headings of the log with their numbers and 1-based lines, in order. */
function headings(log: string): Array<{ number: string; line: number }> {
  return log.split("\n").flatMap((text, index) => {
    const match = HEADING.exec(text);
    return match === null ? [] : [{ number: match[1] as string, line: index + 1 }];
  });
}

/** The decision numbers that have a heading, in order. */
export function headingNumbers(log: string): string[] {
  return headings(log).map((entry) => entry.number);
}

/** A number that two or more headings carry. */
export function findDuplicateHeadings(log: string): DuplicateHeading[] {
  const byNumber = new Map<string, number[]>();
  for (const { number, line } of headings(log)) byNumber.set(number, [...(byNumber.get(number) ?? []), line]);
  return [...byNumber].filter(([, lines]) => lines.length > 1).map(([number, lines]) => ({ number, lines }));
}

/** A citation of a decision number that has no heading in the log. */
export function findDanglingCitations(log: string, files: TextFile[]): DanglingCitation[] {
  const known = new Set(headingNumbers(log));
  return files.flatMap((file) =>
    file.text.split("\n").flatMap((text, index) => [...text.matchAll(CITATION)].filter((match) => !known.has(match[0])).map((match) => ({ path: file.path, line: index + 1, number: match[0] }))),
  );
}
