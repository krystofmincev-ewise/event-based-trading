import { fileURLToPath } from "node:url";
import { defineProject } from "vitest/config";

export default defineProject({
  resolve: {
    alias: {
      "@event-lab/simulation": fileURLToPath(
        new URL("../../packages/simulation/src/index.ts", import.meta.url),
      ),
    },
  },
  test: { name: "api", environment: "node", include: ["test/**/*.test.ts"] },
});
