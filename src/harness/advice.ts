/** The two fields of a harness contract row that the advice reads. A row of `contracts.ts` fits it. */
export interface RoleChangeFacts {
  readonly provider: string;
  readonly roleChange: "next-turn" | "clear";
}

const WHAT_ARRIVES = "the five supervisor tools and the factoryman-supervisor skill";

/**
 * What to tell the owner after a stamp, from the harness contract (report task H4). A row whose `roleChange` is
 * `next-turn` gets its role at the next turn. Every other case, including a provider with no row and a provider that
 * bb did not name, gets the clear instruction, because a clear makes the role reach the model on every harness in the
 * table and an unknown harness must not leave the owner waiting for tools that never come (D-125).
 * The text never says "from its next session": that was wrong for Codex and omp.
 */
export function roleAdvice(threadId: string, providerId: string | null, contract: RoleChangeFacts, unreadReason = "bb returned no provider"): string {
  if (providerId !== null && contract.roleChange === "next-turn") return `It gets ${WHAT_ARRIVES} on its next turn.`;
  const why =
    providerId === null
      ? `bb did not say which harness the thread uses (${unreadReason}).`
      : contract.provider === "*"
        ? `The harness ${providerId} has no recorded role-change behavior.`
        : `This harness (${contract.provider}) applies a new role only when its session is rebuilt.`;
  return `${why}\nRun \`bb thread clear ${threadId}\` so the thread gets ${WHAT_ARRIVES}.`;
}
