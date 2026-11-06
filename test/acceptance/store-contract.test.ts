import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { createMemoryStore } from "../../src/store/memory";
import { openSqliteStore } from "../../src/store/sqlite";
import { describeStoreContract } from "../store-contract";

const dir = mkdtempSync(join(tmpdir(), "factoryman-contract-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

let counter = 0;

// One contract, two stores: the in-memory store that tests use must behave like the SQLite store.
describeStoreContract("memory", () => createMemoryStore());
describeStoreContract("sqlite", () => openSqliteStore(join(dir, `contract-${counter++}.db`)));

describe("project config defaults", () => {
  it.each([
    ["memory", () => createMemoryStore()],
    ["sqlite", () => openSqliteStore(":memory:")],
  ] as const)("reads an unregistered project as no-mistakes with yolo off in the %s store", (_name, make) => {
    const store = make();
    expect(store.getProjectConfig("never-registered")).toMatchObject({ deliveryMode: "no-mistakes", yolo: false });
    store.close();
  });
});
