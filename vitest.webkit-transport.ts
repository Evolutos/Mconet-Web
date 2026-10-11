// Copyright © 2026 Mcont.

import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

import { workspaceSourceAliases } from "./vitest.projects.js";

/**
 * WebKit run of the browser Fetch transport contract.
 *
 * The suite executes inside WebKit so Fetch streams, abort signals, and
 * response headers use that platform. It stays outside the Node contract
 * project, which cannot provide WebKit's implementation.
 */
export default defineConfig({
  resolve: {
    alias: workspaceSourceAliases,
  },
  test: {
    include: ["packages/transport-fetch-browser/src/**/*.webkit.contract.test.ts"],
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [{ browser: "webkit" }],
    },
  },
});
