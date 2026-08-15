import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["research/llm-event-edge/test/**/*.test.ts"],
  },
});
