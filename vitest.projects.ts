// Copyright © 2026 Mcont.

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
  // arrays so later caller mutation cannot rewrite project discovery patterns.
  return packageRoles.map((packageRole) => ({
    test: {
      environment: "node",
      exclude: [...configDefaults.exclude, ...excludePatterns],
      include: [...includePatterns],
      name: nameSuffix ? `${packageRole}-${nameSuffix}` : packageRole,
      root: `./packages/${packageRole}`,
    },
  }));
}
