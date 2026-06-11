import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    exclude: ["dist/**", ".claude/**", "node_modules/**", "widgets-worker/**"],
  },
});
