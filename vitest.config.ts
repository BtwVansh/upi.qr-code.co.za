import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
  resolve: {
    alias: {
      "@": path.resolve(root, "src"),
      // Vitest runs outside the React Server Components condition, where the
      // marker package intentionally throws.
      "server-only": path.resolve(root, "node_modules/server-only/empty.js"),
    },
  },
});
