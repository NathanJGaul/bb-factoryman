// Runs inside the lab. Prints the readiness of every bb provider as one JSON array.
// usage: node provider-states.ts <bb-app dir> <server port>
// `bb.sdk.system.providerStates()` is the free readiness call that bb offers; it sends no prompt and spends nothing.
const [bbAppDir, port] = process.argv.slice(2);
const { BBSdk } = (await import(`${bbAppDir}/dist/index.js`)) as { BBSdk: new (options: { baseUrl: string }) => { system: { providerStates(): Promise<unknown> } } };
const sdk = new BBSdk({ baseUrl: `http://127.0.0.1:${port}` });
const reply = (await sdk.system.providerStates()) as unknown;
const list = (Array.isArray(reply) ? reply : ((reply as { providers?: unknown[] }).providers ?? [])) as Array<Record<string, unknown>>;
process.stdout.write(
  JSON.stringify(
    list.map((p) => ({
      id: p["providerId"],
      status: p["status"],
      message: p["statusMessage"] ?? null,
      installedVersion: p["installedVersion"] ?? null,
      minimumSupportedVersion: p["minimumSupportedVersion"] ?? null,
      loginCommand: p["localLoginCommand"] ?? null,
    })),
  ),
);

export {};
