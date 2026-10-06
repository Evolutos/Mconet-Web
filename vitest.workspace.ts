// Copyright © 2026 Mcont.

import { defineConfig } from "vitest/config";
import type { TestProjectConfiguration } from "vitest/config";

/** Package roles that own independent Vitest projects. */
const packageRoles = [
  "auth-basic",
  "client",
  "codec-json",
  "core-domain",
  "core-runtime",
  "core-spi",
  "integration-openai-compatible",
  "testing",
  "transport-fetch-browser",
  "transport-fetch-node",
] as const;

/**
 * Creates one isolated test project rooted at a workspace package.
 *
 * @param packageRole Workspace package directory and project name.
 * @returns Vitest project configuration for that package.
 */
function createPackageProject(
  packageRole: (typeof packageRoles)[number],
): TestProjectConfiguration {
  return {
    test: {
      environment: "node",
      include: ["src/**/*.{spec,test}.ts"],
      name: packageRole,
      root: `./packages/${packageRole}`,
    },
  };
}

/** Shared workspace test configuration with one project per package. */
export default defineConfig({
  test: {
    passWithNoTests: true,
    projects: packageRoles.map(createPackageProject),
  },
});
