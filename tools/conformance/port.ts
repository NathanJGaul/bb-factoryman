/** One thing a scenario asserts. The id has the form `S<number>.<name>` so a known gap can name it. */
export interface Check {
  id: string;
  title: string;
  ok: boolean;
  /** What the scenario read to decide, in plain words. Never model text. */
  evidence: string;
}

/** What one scenario returned, before the known gaps are applied. */
export interface ScenarioOutcome {
  id: string;
  /** True when the scenario does not run at this tier. */
  skipped?: boolean;
  checks: Check[];
  /** Set when the scenario threw. */
  error?: string;
}
