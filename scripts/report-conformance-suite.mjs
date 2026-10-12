// Copyright © 2026 Mcont.

import process from "node:process";

import { runSuiteReport, selfTestSuiteReport } from "./test-suite-report.mjs";

/**
 * Writes the conformance-suite release report.
 *
 * The report covers the frozen schema and fixture suite only. Unit and
 * contract results remain in their own reports.
 */
async function reportConformanceSuite() {
  await runSuiteReport({
    suite: "conformance",
    config: "vitest.conformance.ts",
  });
}

const argument = process.argv[2];

if (process.argv.length > 3 || (argument !== undefined && argument !== "--self-test")) {
  throw new Error("Usage: node scripts/report-conformance-suite.mjs [--self-test]");
}

if (argument === "--self-test") {
  selfTestSuiteReport();
} else {
  await reportConformanceSuite();
}
