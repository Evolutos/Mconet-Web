// Copyright © 2026 Mcont.

import process from "node:process";

import { runSuiteReport, selfTestSuiteReport } from "./test-suite-report.mjs";

/**
 * Writes the contract-suite release report.
 *
 * Browser transport contracts stay on their own configs, so this command
 * reports only the Node contract projects.
 */
async function reportContractSuite() {
  await runSuiteReport({
    suite: "contract",
    config: "vitest.contract.ts",
  });
}

const argument = process.argv[2];

if (process.argv.length > 3 || (argument !== undefined && argument !== "--self-test")) {
  throw new Error("Usage: node scripts/report-contract-suite.mjs [--self-test]");
}

if (argument === "--self-test") {
  selfTestSuiteReport();
} else {
  await reportContractSuite();
}
