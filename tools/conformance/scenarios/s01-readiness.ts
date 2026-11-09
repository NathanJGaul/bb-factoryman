import { check, type Lab, type Scenario } from "../port.ts";

/** S1: a ready provider dispatches. A provider in any other state is refused, with bb's reason, and no task is created. */
export const s1: Scenario = {
  id: "S1",
  title: "Readiness",
  tiers: ["1", "1.5"],
  async run(lab: Lab) {
    const { provider } = lab.driver;
    const states = await lab.providerStates();
    const own = states.find((s) => s.id === provider);
    const checks = [check("S1.ready", `The provider under test (${provider}) is ready`, own?.status === "ready", own === undefined ? `bb does not list ${provider}` : `${provider} is ${own.status}${own.message === null ? "" : ` (${own.message})`}`)];
    const unready = states.find((s) => s.status !== "ready" && s.id !== provider);
    if (unready === undefined) {
      // Fail closed: with no provider to probe, a pass on S1.ready alone would say nothing about the refusal.
      checks.push(check("S1.unready-blocks", "A dispatch to a provider that is not ready is blocked and creates no task", false, "bb lists no provider in a state other than ready, so the refusal could not be tested."));
      return checks;
    }
    const before = (await lab.tasks()).length;
    const out = await lab.dispatch("scout", "S1 readiness probe", { profile: { ...lab.driver.profile, provider: unready.id } });
    const after = (await lab.tasks()).length;
    checks.push(
      check("S1.unready-blocks", `A dispatch to ${unready.id} (${unready.status}) is blocked and creates no task`, out.taskId === null && out.result.isError && after === before, `task created: ${out.taskId ?? "none"}; tasks ${before} to ${after}; text: ${out.result.text.slice(0, 200)}`),
    );
    const names = out.result.text.includes(unready.status) || (unready.loginCommand !== null && out.result.text.includes(unready.loginCommand));
    checks.push(check("S1.remedy", `The refusal names bb's status "${unready.status}" or its login command`, names, out.result.text.slice(0, 300)));
    return checks;
  },
};
