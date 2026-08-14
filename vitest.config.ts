import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: { reporter: ["text", "html"] },
    projects: ["packages/*/vitest.config.ts", "apps/*/vitest.config.ts"],
  },
});
