// Copyright © 2026 Mcont.

import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

import { workspaceSourceAliases } from "./vitest.projects.js";

/**
 * Firefox run of the browser Fetch transport contract.
 *
 * The suite executes inside Firefox so Fetch streams, abort signals, and
 * response headers use that platform. It stays outside the Node contract
 * project, which cannot provide Firefox's implementation.
 */
export default defineConfig({
  resolve: {
    alias: workspaceSourceAliases,
  },
  test: {
    include: ["packages/transport-fetch-browser/src/**/*.firefox.contract.test.ts"],
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [{ browser: "firefox" }],
    },
  },
});
