// Copyright © 2026 Mcont.

import process from "node:process";

import { runSuiteReport, selfTestSuiteReport } from "./test-suite-report.mjs";

/**
 * Writes the unit-suite release report.
 *
 * Contract and conformance files stay on their own configs, so this command
 * cannot pass by borrowing another suite's results.
 */
async function reportUnitSuite() {
  await runSuiteReport({
    suite: "unit",
    config: "vitest.workspace.ts",
  });
}

const argument = process.argv[2];

if (process.argv.length > 3 || (argument !== undefined && argument !== "--self-test")) {
  throw new Error("Usage: node scripts/report-unit-suite.mjs [--self-test]");
}

if (argument === "--self-test") {
  selfTestSuiteReport();
} else {
  await reportUnitSuite();
}
