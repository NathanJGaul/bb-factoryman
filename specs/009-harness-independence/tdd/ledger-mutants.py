"""Revert-red ledger runner for feature 009 (harness independence).

Each entry of MUT is one deliberate mutant of a production file. For a mutant the runner edits the file, runs the unit
tests (src), the seven acceptance files of the feature, and test/acceptance/dispatch-resolver.test.ts, prints one JSON
line with the behavior ids whose tests failed, restores the file, and checks by hash that the file is byte-identical.
The cycle log ("Remediation 1") holds the table that this runner produced for the 71 behaviors without a recorded red.

Run it from the repository root, with the working tree clean:

    python3 -I specs/009-harness-independence/tdd/ledger-mutants.py 1 58     # every mutant
    python3 -I specs/009-harness-independence/tdd/ledger-mutants.py 10 10    # only L10

A mutant must make at least one behavior fail ("failed_behaviors" not empty). The runner never leaves a mutant in the tree.
"""
import hashlib, json, subprocess, sys, re

TESTS = ["src", "test/acceptance/harness-configure.test.ts", "test/acceptance/harness-readiness.test.ts", "test/acceptance/harness-admission.test.ts",
         "test/acceptance/harness-models.test.ts", "test/acceptance/harness-default.test.ts", "test/acceptance/harness-failure.test.ts", "test/acceptance/dispatch-resolver.test.ts"]
R = "src/dispatch/availability.ts"
MUT = [
 ("L01 unauthenticated counts as ready", R, 'case "unauthenticated":\n      return `${name} is not signed in', 'case "unauthenticated":\n      return null;\n      return `${name} is not signed in'),
 ("L02 expired counts as ready", R, 'case "expired":\n      return `${name} has an expired login', 'case "expired":\n      return null;\n      return `${name} has an expired login'),
 ("L03 too-old version counts as ready", R, 'case "unsupported_version":\n      return `${name} is too old', 'case "unsupported_version":\n      return null;\n      return `${name} is too old'),
 ("L04 status unknown counts as ready", R, 'case "unknown":\n      return `${name} is in a state', 'case "unknown":\n      return null;\n      return `${name} is in a state'),
 ("L05 states read for the default host, not the placed machine", "src/dispatch/gate.ts", 'bb.getProviderStates(hostId)', 'bb.getProviderStates(undefined)'),
 ("L06 the preflight ignores readiness", "src/machines/preflight.ts", 'problem !== null || !listed.has(provider)', '!listed.has(provider)'),
 ("L07 the queue start ignores the gate", "src/limits/queue.ts", 'if (!gate.ok) {\n      // A refusal', 'if (false as boolean) {\n      // A refusal'),
 ("L08 the gate always blocks", "src/dispatch/gate.ts", 'return problem === null ? { ok: true } : { ok: false, code: "provider_unavailable", message: problem, permanent: false };', 'return { ok: false, code: "provider_unavailable", message: problem ?? "x", permanent: false };'),
 ("L09 dispatch creates a task before it blocks", "src/tools/dispatch.ts", '  if (!gate.ok) {\n    return failure(', '  if (!gate.ok) {\n    rt.log.create({ type: "create", actor: "supervisor", taskId: rt.deps.newId(), projectId: caller.projectId, kind, mode: config.deliveryMode });\n    return failure('),
 ("L10 Pi sandbox row says available", "src/harness/contracts.ts", 'sandbox: "none"', 'sandbox: "available"'),
 ("L11 Pi has no refusal reason", "src/harness/contracts.ts", 'refusalReason: PI_REASON', 'refusalReason: null'),
 ("L12 unknown provider gets the first row", "src/harness/contracts.ts", 'BY_PROVIDER.get(providerId) ?? GENERIC_CONTRACT', 'BY_PROVIDER.get(providerId) ?? (CONTRACTS[0] as HarnessContract)'),
 ("L13 tool hint on at the plugin factory", "src/server.ts", 'toolHints: options.toolHints === true', 'toolHints: options.toolHints !== false'),
 ("L14 tool hint on in registerTools", "src/tools/register.ts", 'options.toolHints !== true ||', 'options.toolHints === false ||'),
 ("L15 a hint for every worker", "src/tools/register.ts", 'return hint === null ? selection : { ...selection, instructions: hint };', 'return { ...selection, instructions: hint ?? "x" };'),
 ("L16 the hint for every role", "src/tools/register.ts", ' || context.pluginMetadata["role"] !== "worker"', ''),
 ("L17 Pi refuses direct-PR and not local-only", "src/harness/contracts.ts", 'refusedModes: ["local-only"]', 'refusedModes: ["direct-PR"]'),
 ("L18 codex refused in local-only", "src/harness/contracts.ts", 'provider: "codex",\n    testedWith: { cli: "0.166.0", bb: TESTED_BB },\n    workerModes: ["accept-edits", "auto", "full"],\n    sandbox: "available",\n    refusedModes: [],\n    refusalReason: null,', 'provider: "codex",\n    testedWith: { cli: "0.166.0", bb: TESTED_BB },\n    workerModes: ["accept-edits", "auto", "full"],\n    sandbox: "available",\n    refusedModes: ["local-only"],\n    refusalReason: "x",'),
 ("L19 a generic provider refused in local-only", "src/dispatch/gate.ts", 'if (!contract.refusedModes.includes(mode)) return null;', 'if (contract.provider !== "*" && !contract.refusedModes.includes(mode)) return null;'),
 ("L20 the queue start does not fail a refused task", "src/limits/queue.ts", 'if (gate.code === "provider_not_admitted") {', 'if (false as boolean) {'),
 ("L21 the queue start fails a task on any block", "src/limits/queue.ts", 'if (gate.code === "provider_not_admitted") {', 'if (true as boolean) {'),
 ("L22 the gate skips admission", "src/dispatch/gate.ts", '  const refusal = admit(profile.provider, mode);\n  if (refusal !== null) return { ok: false, code: "provider_not_admitted", message: refusal, permanent: true };\n  const hostId = host?.id;', '  const hostId = host?.id;'),
 ("L23 the gate is skipped for an explicit profile", "src/tools/dispatch.ts", 'const gate = await gateProfile(bb, profile, config.deliveryMode, host);', 'const gate: Awaited<ReturnType<typeof gateProfile>> = explicit !== undefined ? { ok: true } : await gateProfile(bb, profile, config.deliveryMode, host);'),
 ("L24 the resolver ignores the explicit profile", "src/dispatch/resolver.ts", 'if (choice.profile !== undefined) {', 'if (choice.profile !== undefined && false as boolean) {'),
 ("L25 the resolver ignores default", "src/dispatch/resolver.ts", 'if (config.default !== null) {', 'if (false as boolean) {'),
 ("L26 a built-in default returns", "src/dispatch/resolver.ts", 'return blocked("no_default_profile", NO_PROFILE_MESSAGE);', 'return { status: "clear", profile: { provider: "claude-code", model: "claude-sonnet-5-5", reasoningLevel: "high", permissionMode: "auto" }, source: "default", ruleId: null, machine: null };'),
 ("L27 init writes with flag w", "src/files.ts", 'flag: "wx"', 'flag: "w"'),
 ("L28 init skips the profile check", "src/dispatch/init.ts", '  if (problem !== null) return fail(problem);', ''),
 ("L29 init prefers full mode", "src/dispatch/init.ts", 'const MODE_ORDER = ["auto", "accept-edits", "full"] as const;', 'const MODE_ORDER = ["full", "accept-edits", "auto"] as const;'),
 ("L30 init does not accept an unlisted provider check", "src/dispatch/init.ts", 'if (provider === undefined) return fail(', 'if (provider === undefined && false) return fail('),
 ("L31 init changes state in bb", "src/dispatch/init.ts", '  const model = flags["--model"]', '  await bb.sendMessage("thr-x", "x");\n  const model = flags["--model"]'),
 ("L32 the model's levels never decide", R, 'if (listed !== undefined && listed.reasoningKnown) {', 'if (false as boolean) {'),
 ("L33 a model with unknown levels is judged by its listed levels", R, 'if (listed !== undefined && listed.reasoningKnown) {', 'if (listed !== undefined) {'),
 ("L34 a listed level on both lists is refused", R, '    return listed.reasoningLevels.includes(profile.reasoningLevel)\n      ? null', '    return listed.reasoningLevels.includes(profile.reasoningLevel) && !found.reasoningLevels.includes(profile.reasoningLevel)\n      ? null'),
 ("L35 unlisted models are refused for every provider", R, 'contractFor(profile.provider).unlistedModels === "refused"', 'true'),
 ("L36 Pi accepts unlisted models", "src/harness/contracts.ts", 'refusalReason: PI_REASON,\n    unlistedModels: "refused",', 'refusalReason: PI_REASON,\n    unlistedModels: "accepted",'),
 ("L37 an array ladder is ignored", "src/dispatch/types.ts", 'if (Array.isArray(levels)) return levels;', 'if (Array.isArray(levels)) return DEFAULT_REASONING_LEVELS;'),
 ("L38 a record entry is ignored", "src/dispatch/types.ts", 'return Object.hasOwn(byProvider, providerId) ? (byProvider[providerId] as readonly string[]) : DEFAULT_REASONING_LEVELS;', 'return DEFAULT_REASONING_LEVELS;'),
 ("L39 an omitted provider has no ladder", "src/dispatch/types.ts", 'return Object.hasOwn(byProvider, providerId) ? (byProvider[providerId] as readonly string[]) : DEFAULT_REASONING_LEVELS;', 'return byProvider[providerId] as readonly string[];'),
 ("L40 a record key may be blank", "src/dispatch/config.ts", 'z.record(nonBlank, levelList)', 'z.record(z.string(), levelList)'),
 ("L41 an array ladder is dropped by the parser", "src/dispatch/config.ts", 'return { ok: true, config: { ...rest, default: defaultName ?? null } };', 'return { ok: true, config: { ...rest, reasoningLevels: Array.isArray(rest.reasoningLevels) ? [...DEFAULT_REASONING_LEVELS] : rest.reasoningLevels, default: defaultName ?? null } };'),
 ("L42 the parser accepts a string for reasoningLevels", "src/dispatch/config.ts", 'z.union([levelList, z.record(nonBlank, levelList)])', 'z.union([levelList, z.record(nonBlank, levelList), z.string().transform(() => ["low"])])'),
 ("L43 the models read ignores a failure", "src/dispatch/gate.ts", 'if (!models.ok) return { ok: false, code: "read_failed", message: models.message };', ''),
 ("L44 a write error is swallowed", "src/files.ts", 'if ((error as { code?: unknown } | null)?.code === "EEXIST") return "exists";\n      throw error;', 'return "exists";'),
 ("L45 boundCause rewrites the middle dot", "src/wiring/failure-cause.ts", '.trim();\n  return flat.length', '.trim().replace(/·/g, "-");\n  return flat.length'),
 ("L46 boundCause cuts at 299", "src/wiring/failure-cause.ts", 'flat.length <= CAUSE_LIMIT', 'flat.length < CAUSE_LIMIT'),
 ("L47 remedyFor falls back to the sign-in hint", "src/wiring/failure-cause.ts", '  return null;\n}', '  return SIGN_IN_REMEDY;\n}'),
 ("L48 remedyFor checks sign-in before model", "src/wiring/failure-cause.ts", '  if (NO_MODEL.some((pattern) => pattern.test(cause))) return MODEL_REMEDY;\n  if (NOT_SIGNED_IN.some((pattern) => pattern.test(cause)) || status === 401 || category === "unauthorized") return SIGN_IN_REMEDY;', '  if (NOT_SIGNED_IN.some((pattern) => pattern.test(cause)) || status === 401 || category === "unauthorized") return SIGN_IN_REMEDY;\n  if (NO_MODEL.some((pattern) => pattern.test(cause))) return MODEL_REMEDY;'),
 ("L49 the oldest error event is read", "src/bb/adapter.ts", 'order: "desc", limit: "1" });\n      const data', 'order: "asc", limit: "1" });\n      const data'),
 ("L50 the failed wake limit stays 600", "src/wiring/wake.ts", 'const FAILURE_LIMIT = 1200;', 'const FAILURE_LIMIT = 600;'),
 ("L51 a failed cause read throws out of the handler", "src/wiring/handlers.ts", '    } catch (error) {\n      this.rt.deps.log.warn(`Could not read why worker thread', '    } catch (error) {\n      throw error;\n      this.rt.deps.log.warn(`Could not read why worker thread'),
 ("L52 the cause is never read", "src/wiring/handlers.ts", 'const cause = await this.causeOf(payload.thread.id);', 'const cause = null as string | null;'),
 ("L53 the cause is not bounded", "src/wiring/handlers.ts", 'const bounded = raw === null ? "" : boundCause(raw);', 'const bounded = raw === null ? "" : raw;'),
 ("L54 the cause is read before the state check", "src/wiring/handlers.ts", 'if (!task || (task.state !== "working" && task.state !== "blocked")) return;\n      const text', 'await this.causeOf(payload.thread.id);\n      if (!task || (task.state !== "working" && task.state !== "blocked")) return;\n      const text'),
 ("L55 a ready named provider gives a preflight problem", "src/machines/preflight.ts", 'problem !== null || !listed.has(provider)', 'true'),
 ("L56 dispatch reads provider states before it places the machine", "src/tools/dispatch.ts", '  const parsed = dispatchSchema.safeParse(raw);', '  await bb.getProviderStates();\n  const parsed = dispatchSchema.safeParse(raw);'),
 ("L57 the level check runs before the mode check", R, 'if (!found.permissionModes.includes(profile.permissionMode)) {', 'if (found.reasoningLevels.length > 0 && !found.reasoningLevels.includes(profile.reasoningLevel)) return `The provider \\`${profile.provider}\\` does not list the reasoning level \\`${profile.reasoningLevel}\\`. It lists: ${found.reasoningLevels.join(", ")}.`;\n  if (!found.permissionModes.includes(profile.permissionMode)) {'),
 ("L58 Pi refused in no-mistakes as well", "src/harness/contracts.ts", 'refusedModes: ["local-only"]', 'refusedModes: ["local-only", "no-mistakes"]'),
]

def sha(p): return hashlib.sha256(open(p, "rb").read()).hexdigest()
lo, hi = int(sys.argv[1]), int(sys.argv[2])
for i, (label, path, old, new) in enumerate(MUT, 1):
    if not (lo <= i <= hi): continue
    before = sha(path); text = open(path, encoding="utf-8").read()
    if text.count(old) != 1:
        print(json.dumps({"mutant": label, "applicable": False, "matches": text.count(old)})); continue
    open(path, "w", encoding="utf-8").write(text.replace(old, new, 1))
    try:
        r = subprocess.run(["pnpm", "vitest", "run", *TESTS], capture_output=True, text=True)
        out = r.stdout + r.stderr
        failed = sorted({m.group(1) for line in out.splitlines() if line.strip().startswith("×") for m in re.finditer(r"\[([AU]1[34]\d\d)\]", line)})
        print(json.dumps({"mutant": label, "applicable": True, "failed_behaviors": failed, "exit": r.returncode}))
    finally:
        open(path, "w", encoding="utf-8").write(text)
    assert sha(path) == before, f"{path} was not restored"
