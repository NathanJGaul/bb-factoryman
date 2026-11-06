import js from "@eslint/js";
import tseslint from "typescript-eslint";

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
          patterns: [
            {
              group: ["@get-bb/*"],
              message: "src/machine/ must not import bb packages. Pass plain data in and out.",
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
