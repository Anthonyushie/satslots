import { defineConfig } from "@playwright/test";

// Reuse the existing TypeScript-capable test runner; no browser or server needed.
export default defineConfig({
  testDir: "./src/lib/nostr",
  testMatch: "**/*.test.ts",
  fullyParallel: true,
  workers: 2,
  retries: 0,
  reporter: "list",
});
