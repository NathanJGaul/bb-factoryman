// pnpm run conformance:docs [--root <dir>]
// Writes docs/HARNESS-SUPPORT.md from conformance/results/*.json and from nothing else.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { renderSupport } from "./docs.ts";
import { parseResult } from "./result.ts";

const rootFlag = process.argv.indexOf("--root");
const root = rootFlag === -1 ? resolve(dirname(fileURLToPath(import.meta.url)), "../..") : resolve(process.argv[rootFlag + 1] ?? ".");
const dir = join(root, "conformance/results");
let names: string[] = [];
try {
  names = readdirSync(dir).filter((name) => name.endsWith(".json")).sort();
} catch {
  names = [];
}
const results = names.map((name) => parseResult(readFileSync(join(dir, name), "utf8")));
const out = join(root, "docs/HARNESS-SUPPORT.md");
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, renderSupport(results));
process.stdout.write(`Wrote ${out} from ${results.length} result file(s).\n`);
