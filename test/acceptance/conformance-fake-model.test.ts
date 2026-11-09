import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { createInterface } from "node:readline";
import { afterEach, describe, expect, it } from "vitest";
import { tmpDir } from "../fixtures/git-repo";

const SERVER = new URL("../../tools/fake-model/server.ts", import.meta.url).pathname;

interface Running {
  child: ChildProcessWithoutNullStreams;
  url: string;
  address: string;
  log: () => Array<Record<string, unknown>>;
}
const started: Running[] = [];
afterEach(() => {
  for (const running of started.splice(0)) running.child.kill();
});

/** Start the server the way a lab does: as a process, with a port and a log file, and read where it listens from its first line. */
async function start(): Promise<Running> {
  const logFile = join(tmpDir("fake-model-acc-"), "requests.jsonl");
  const child = spawn(process.execPath, [SERVER, "--port", "0", "--log", logFile]);
  const first = await new Promise<string>((resolve, reject) => {
    createInterface({ input: child.stdout }).once("line", resolve);
    child.once("exit", (code) => reject(new Error(`the server exited with ${code}`)));
  });
  const listening = (JSON.parse(first) as { listening: string }).listening;
  const running: Running = {
    child,
    url: `http://${listening}`,
    address: listening.split(":")[0] as string,
    log: () => (existsSync(logFile) ? readFileSync(logFile, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)) : []),
  };
  started.push(running);
  return running;
}
const post = (url: string, body: unknown) => fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const WORKER = (flag: string) => `You are the worker for scout task t-9. The delivery mode is local-only.\n\nTask:\nlook ${flag}\n\nFirst, create and switch to the branch fm/t-9.\n`;
const BASH = { name: "Bash", description: "", input_schema: { type: "object", properties: { command: { type: "string" } }, required: ["command"] } };

describe("the fake model server as a process", () => {
  it("[A1318] answers a chat completions, a Responses, and a Messages request each in its own format", async () => {
    const { url } = await start();
    const chat = await post(`${url}/v1/chat/completions`, { model: "m", stream: false, messages: [{ role: "user", content: "hi" }] });
    expect(((await chat.json()) as { choices: unknown[] }).choices).toHaveLength(1);
    const responses = await post(`${url}/v1/responses`, { model: "m", stream: true, input: "hi" });
    expect(await responses.text()).toContain("event: response.completed");
    const messages = await post(`${url}/v1/messages`, { model: "m", stream: true, messages: [{ role: "user", content: "hi" }] });
    expect(await messages.text()).toContain("event: message_stop");
  });

  it("[A1319] plays the behavior that the task description's marker asks for", async () => {
    const { url } = await start();
    const request = (flag: string) => post(`${url}/v1/messages`, { model: "m", stream: false, messages: [{ role: "user", content: WORKER(flag) }], tools: [BASH] });
    const normal = (await (await request("")).json()) as { stop_reason: string; content: Array<{ name: string; input: { command: string } }> };
    expect(normal.stop_reason).toBe("tool_use");
    expect(normal.content[0]?.input.command).toBe("git checkout -b fm/t-9");
    const failing = await request("[brain:fail=429]");
    expect(failing.status).toBe(429);
    expect(JSON.stringify(await failing.json())).toContain("CONFORMANCE-CAUSE-429");
  });

  it("[A1320] logs which tools and skills the harness offered the model", async () => {
    const { url, log } = await start();
    await post(`${url}/v1/messages`, { model: "m", stream: false, system: "Skills: bb-global-skills:factoryman-worker", messages: [{ role: "user", content: WORKER("") }], tools: [BASH] });
    expect(log().at(-1)).toMatchObject({ wire: "messages", tools: ["Bash"], skills: ["factoryman-worker"], actor: "worker:t-9" });
  });

  it("[U1426] takes an option only when it is on the command line, and refuses a missing --log", async () => {
    // A missing --bodies once made the server write its request bodies into a file named after --port.
    const cwd = tmpDir("fake-model-cwd-");
    const logFile = join(tmpDir("fake-model-log-"), "requests.jsonl");
    const child = spawn(process.execPath, [SERVER, "--port", "0", "--log", logFile], { cwd });
    started.push({ child, url: "", address: "", log: () => [] });
    const first = await new Promise<string>((resolve) => createInterface({ input: child.stdout }).once("line", resolve));
    const listening = (JSON.parse(first) as { listening: string }).listening;
    await fetch(`http://${listening}/v1/messages`, { method: "POST", body: JSON.stringify({ model: "m", stream: false, messages: [{ role: "user", content: "hi" }] }) });
    expect(readdirSync(cwd)).toEqual([]);
    const refused = spawnSync(process.execPath, [SERVER, "--port", "0"], { cwd, encoding: "utf8" });
    expect(refused.status).toBe(2);
    expect(readdirSync(cwd)).toEqual([]);
  });

  it("[A1321] listens on the loopback only", async () => {
    const { address } = await start();
    expect(address).toBe("127.0.0.1");
  });
});
