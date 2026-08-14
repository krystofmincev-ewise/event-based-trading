import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "simulation",
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
