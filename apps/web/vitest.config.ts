import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineProject } from "vitest/config";

export default defineProject({
  plugins: [react()],
  resolve: {
    alias: {
      "@event-lab/simulation": fileURLToPath(
        new URL("../../packages/simulation/src/index.ts", import.meta.url),
      ),
    },
  },
  test: {
    name: "web",
    environment: "jsdom",
    include: ["test/**/*.test.tsx"],
    setupFiles: ["./test/setup.ts"],
  },
});
