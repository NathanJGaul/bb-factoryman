import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { projectRowScript } from "../../tools/conformance/lab-env.ts";
import { openSqliteStore } from "../../src/store/sqlite";
import type { DeliveryMode } from "../../src/machine/types";
import { tmpDir } from "../fixtures/git-repo";

const ROOT = new URL("../../", import.meta.url).pathname;

/** Make the plugin's database with its own schema, run the lab's row script against it, and read the row back through the plugin's store. */
function rowAfterScript(mode: DeliveryMode) {
  const dataDir = tmpDir("project-row-");
  mkdirSync(join(dataDir, "plugins/bb-factoryman"), { recursive: true });
  const file = join(dataDir, "plugins/bb-factoryman/data.db");
  openSqliteStore(file).close();
  const run = spawnSync(process.execPath, ["-e", projectRowScript("proj_x", mode)], { cwd: ROOT, env: { PATH: process.env["PATH"] ?? "/usr/bin:/bin", BB_DATA_DIR: dataDir }, encoding: "utf8" });
  expect(run.status, run.stderr).toBe(0);
  const store = openSqliteStore(file);
  const config = store.getProjectConfig("proj_x");
  store.close();
  return config;
}

describe("the lab's project row", () => {
  it("[U1531] is read back by the plugin's store with the given mode, base branch main, and yolo off", () => {
    for (const mode of ["direct-PR", "local-only"] as const) {
      expect(rowAfterScript(mode), mode).toEqual({ projectId: "proj_x", deliveryMode: mode, yolo: false, branchPrefix: null, baseBranch: "main", defaultMachine: null });
    }
  });
});
