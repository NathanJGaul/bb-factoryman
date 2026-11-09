import { readdirSync } from "node:fs";
import { builtinModules } from "node:module";
import { join } from "node:path";
import js from "@eslint/js";
import tseslint from "typescript-eslint";

const nodeBuiltins = builtinModules.filter((name) => !name.startsWith("_"));

// Everything in src/ except the browser side is the server side. Reading the directory means a new server layer is restricted without a config change.
const BROWSER_SIDE = new Set(["app", "app.tsx", "approval"]);
const serverLayers = readdirSync(join(import.meta.dirname, "src"))
  .filter((entry) => !BROWSER_SIDE.has(entry))
  .map((entry) => entry.replace(/\.[cm]?[jt]sx?$/, ""));

export default tseslint.config(
  {
    ignores: ["node_modules/**", "dist/**", "coverage/**", ".specify/**", ".claude/**", "specs/**", "spike/**", "docs/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // src/machine/ stays free of bb so every gate is testable without a running bb.
    files: ["src/machine/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          // Exact names only: a pattern like "events" would also match the sibling module "./events".
          paths: nodeBuiltins.map((name) => ({
            name,
            message: "src/machine/ must not use Node built-ins, because the machine performs no input or output.",
          })),
          patterns: [
            {
              group: ["@get-bb/*"],
              message: "src/machine/ must not import bb packages. Pass plain data in and out.",
            },
            {
              group: ["better-sqlite3"],
              message: "src/machine/ must not touch storage. Storage depends on the machine, not the reverse.",
            },
            {
              group: ["node:*"],
              message: "src/machine/ must not use Node built-ins, because the machine performs no input or output.",
            },
            {
              group: ["**/store", "**/store/**"],
              message: "src/machine/ must not import src/store. Storage depends on the machine, not the reverse.",
            },
          ],
        },
      ],
      // no-restricted-imports does not see import() calls, so ban them outright.
      "no-restricted-syntax": [
        "error",
        {
          selector: "ImportExpression",
          message: "src/machine/ must not load modules dynamically, because that can hide a bb import.",
        },
      ],
    },
  },
  {
    // The harness contract table is data only. It imports nothing, so no bb change and no other layer can reach it.
    files: ["src/harness/**/*.ts"],
    ignores: ["**/*.test.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: nodeBuiltins.map((name) => ({
            name,
            message: "src/harness/ is data only and imports nothing.",
          })),
          patterns: [{ group: ["**"], message: "src/harness/ is data only and imports nothing." }],
        },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector: "ImportExpression",
          message: "src/harness/ is data only and loads no module.",
        },
      ],
    },
  },
  {
    // The frontend bundle loads in the browser on every page of the bb app. It must carry no server code,
    // no Node built-in, and no schema library, so the bundle stays small and the server stays out of it.
    files: ["src/app.tsx", "src/app/**/*.{ts,tsx}", "src/approval/**/*.ts"],
    ignores: ["**/*.test.ts", "**/*.test.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            ...nodeBuiltins.map((name) => ({
              name,
              message: "The frontend runs in the browser and cannot use Node built-ins.",
            })),
            { name: "@get-bb/plugin-sdk", message: "The frontend imports the SDK through @get-bb/plugin-sdk/app, never the backend root." },
            { name: "better-sqlite3", message: "The frontend must not touch storage." },
            { name: "zod", message: "The frontend ships no schema library. Read values with the plain functions in src/approval/." },
          ],
          patterns: [
            { group: ["node:*"], message: "The frontend runs in the browser and cannot use Node built-ins." },
            {
              group: ["@get-bb/plugin-sdk/*", "!@get-bb/plugin-sdk/app"],
              message: "The frontend may import only @get-bb/plugin-sdk/app from the SDK.",
            },
            {
              group: serverLayers.flatMap((layer) => [`**/${layer}`, `**/${layer}/**`]),
              message: "The frontend must not import server code. Share values through src/approval/ only.",
            },
          ],
        },
      ],
    },
  },
);
