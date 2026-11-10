import { describe, expect, it } from "vitest";
import { roleAdvice } from "./advice";
import { CONTRACTS, GENERIC_CONTRACT, contractFor } from "./contracts";

const CLEAR_LINE = (thread: string) => `Run \`bb thread clear ${thread}\` so the thread gets the five supervisor tools and the factoryman-supervisor skill.`;

describe("roleAdvice", () => {
  it("[U1651] names the thread and the provider and gives the clear instruction for a row that needs a clear", () => {
    const text = roleAdvice("thr-9", "codex", contractFor("codex"));
    expect(text).toContain("This harness (codex) applies a new role only when its session is rebuilt.");
    expect(text).toContain(CLEAR_LINE("thr-9"));
  });

  it("[U1652] says the tools and the skill arrive at the next turn, and gives no clear instruction, for a row that needs none", () => {
    const text = roleAdvice("thr-9", "claude-code", contractFor("claude-code"));
    expect(text).toContain("It gets the five supervisor tools and the factoryman-supervisor skill on its next turn.");
    expect(text).not.toMatch(/clear/i);
  });

  it("[U1653] names the provider, says it has no recorded role-change behavior, and gives the clear instruction for the generic row", () => {
    const text = roleAdvice("thr-9", "acp-never-heard-of-it", GENERIC_CONTRACT);
    expect(text).toContain("The harness acp-never-heard-of-it has no recorded role-change behavior.");
    expect(text).toContain(CLEAR_LINE("thr-9"));
  });

  it("[U1654] says that bb did not name the harness, with the reason, and gives the clear instruction for an unreadable provider", () => {
    const text = roleAdvice("thr-9", null, GENERIC_CONTRACT, "HTTP 500");
    expect(text).toContain("bb did not say which harness the thread uses (HTTP 500).");
    expect(text).toContain(CLEAR_LINE("thr-9"));
    expect(roleAdvice("thr-9", null, GENERIC_CONTRACT)).toContain("bb did not say which harness the thread uses (bb returned no provider).");
  });

  it.each([...CONTRACTS, GENERIC_CONTRACT].map((row) => [row.provider, row] as const))("[U1655] gives the clear instruction for %s exactly when its roleChange is clear, and never the old text", (_provider, row) => {
    const text = roleAdvice("thr-9", row.provider === "*" ? null : row.provider, row);
    expect(text.includes("bb thread clear thr-9")).toBe(row.roleChange === "clear");
    expect(text).not.toContain("from its next session");
  });
});
