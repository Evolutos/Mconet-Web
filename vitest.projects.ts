// Copyright © 2026 Mcont.

import path from "node:path";

import { configDefaults } from "vitest/config";
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
 * Source aliases used when tests cross a workspace package boundary.
 *
 * Unit and contract tests must run from a clean checkout without requiring
 * generated package output. Package tarball verification separately exercises
 * the published `dist` entry points, so these aliases cannot mask packaging
 * failures.
 */
const workspaceSourceAliases = Object.freeze(
  Object.fromEntries(
    // Derive every alias from the reviewed package role list so package discovery
    // and internal test resolution cannot drift into separate naming schemes.
    packageRoles.map((packageRole) => [
      `@evolutos/mconet-${packageRole}`,
      path.resolve(import.meta.dirname, "packages", packageRole, "src", "index.ts"),
    ]),
  ),
);

/**
 * Creates one isolated Vitest project for every workspace package.
 *
 * @param includePatterns Suite-specific file discovery patterns.
 * @param excludePatterns Patterns that must remain outside this suite.
 * @param nameSuffix Optional suite suffix used to disambiguate reports.
 * @returns Stable package-ordered Vitest project configurations.
 */
export function createPackageProjects(
  includePatterns: readonly string[],
  excludePatterns: readonly string[] = [],
  nameSuffix?: string,
): readonly TestProjectConfiguration[] {
  // Preserve reviewed package order while creating isolated roots. Clone input
  // arrays so later caller mutation cannot rewrite project discovery patterns;
  // share only the immutable source-alias map across project configurations.
  return packageRoles.map((packageRole) => ({
    resolve: {
      alias: workspaceSourceAliases,
    },
    test: {
      environment: "node",
      exclude: [...configDefaults.exclude, ...excludePatterns],
      include: [...includePatterns],
      name: nameSuffix ? `${packageRole}-${nameSuffix}` : packageRole,
      root: `./packages/${packageRole}`,
    },
  }));
}
