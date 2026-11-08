import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "bb-factoryman",
    include: ["src/**/*.test.{ts,tsx}", "test/**/*.test.{ts,tsx}"],
    exclude: ["node_modules/**", ".specify/**", ".claude/**"],
    environment: "node",
  },
});
