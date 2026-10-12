// Copyright © 2026 Mcont.

import process from "node:process";

import { runSuiteReport, selfTestSuiteReport } from "./test-suite-report.mjs";

/**
 * Header tests that must reject CR, LF, and forbidden header names.
 *
 * A successful header case in the same file does not count as an injection
 * acceptance; each listed file contains the rejection case for that boundary.
 */
const headerInjectionTests = [
  "packages/auth-basic/src/validate-authorization-header-name.test.ts",
  "packages/auth-basic/src/validate-authorization-header-value.test.ts",
  "packages/auth-basic/src/bearer-authorization-handler.test.ts",
  "packages/auth-basic/src/api-key-header-authorization-handler.test.ts",
  "packages/core-runtime/src/schedule-apply-authorization.test.ts",
  "packages/transport-fetch-browser/src/browser-forbidden-headers.test.ts",
  "packages/transport-fetch-shared/src/map-fetch-headers.test.ts",
];

/**
 * Writes the header-injection security report.
 */
async function reportHeaderInjection() {
  await runSuiteReport({
    suite: "header-injection",
    config: "vitest.workspace.ts",
    files: headerInjectionTests,
  });
}

const argument = process.argv[2];

if (process.argv.length > 3 || (argument !== undefined && argument !== "--self-test")) {
  throw new Error("Usage: node scripts/report-header-injection.mjs [--self-test]");
}

if (argument === "--self-test") {
  selfTestSuiteReport();
} else {
  await reportHeaderInjection();
}
