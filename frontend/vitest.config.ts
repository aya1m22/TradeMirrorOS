import { defineConfig } from "vitest/config";
import { fileURLToPath, URL } from "node:url";

// Node environment — these suites cover the pure extraction pipeline and
// upload validation, not React components.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
