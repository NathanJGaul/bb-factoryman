import { describe, expect, it } from "vitest";
import { findDanglingCitations, findDuplicateHeadings, headingNumbers } from "./decision-log.ts";

/** Builds a decision number, so that this file holds no literal citation of a number that has no heading. */
const n = (value: number) => `D-${String(value).padStart(3, "0")}`;
const heading = (value: number, title = "A decision") => `### ${n(value)}: ${title} (Gap)`;
const log = (...lines: string[]) => ["# Decisions", "", ...lines].join("\n");

describe("the decision log checker", () => {
  it("[U1521] reports a heading number that appears twice, with the line of each heading", () => {
    const text = log(heading(1), "Text.", heading(2), "Text.", heading(1, "Another decision"));
    expect(findDuplicateHeadings(text)).toEqual([{ number: n(1), lines: [3, 7] }]);
    expect(headingNumbers(text)).toEqual([n(1), n(2), n(1)]);
  });

  it("[U1522] reports a citation whose number has no heading, with its file and line", () => {
    const text = log(heading(1), heading(2));
    const files = [
      { path: "docs/a.md", text: `First line.\nSee ${n(2)} and ${n(998)}.\n` },
      { path: "src/b.ts", text: `// ${n(1)} is fine\n// ${n(999)} is not\n` },
    ];
    expect(findDanglingCitations(text, files)).toEqual([
      { path: "docs/a.md", line: 2, number: n(998) },
      { path: "src/b.ts", line: 2, number: n(999) },
    ]);
  });

  it("[U1523] reports nothing for a log with unique headings and citations that resolve", () => {
    const text = log(heading(1), heading(2), heading(3));
    expect(findDuplicateHeadings(text)).toEqual([]);
    expect(findDanglingCitations(text, [{ path: "docs/a.md", text: `${n(1)} to ${n(3)}, and ${n(2)}.` }])).toEqual([]);
    expect(headingNumbers(text)).toEqual([n(1), n(2), n(3)]);
  });
});
