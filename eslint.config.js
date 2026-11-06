import { builtinModules } from "node:module";
import js from "@eslint/js";
import tseslint from "typescript-eslint";

const nodeBuiltins = builtinModules.filter((name) => !name.startsWith("_"));

export default tseslint.config(
  {
    ignores: ["node_modules/**", "dist/**", ".specify/**", ".claude/**", "specs/**", "spike/**", "docs/**"],
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
);
