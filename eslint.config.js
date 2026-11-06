import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["node_modules/**", "dist/**", ".specify/**", ".claude/**", "specs/**", "spike/**", "docs/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
);
