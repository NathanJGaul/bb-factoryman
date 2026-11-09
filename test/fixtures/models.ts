/**
 * The model IDs that the existing tests dispatch with. An unscripted fake provider lists them, so a test that
 * scripts no model list keeps its meaning. `FakeBbPort` and `loadWorld` both read this one list, so they cannot drift.
 * A test that needs a model outside the list, or a provider that lists none, scripts its own list.
 */
export const DEFAULT_MODEL_IDS: readonly string[] = ["opus", "sonnet", "haiku", "claude-sonnet-5-5", "stub-model", "m", "b", "other", "opus-strict"];
