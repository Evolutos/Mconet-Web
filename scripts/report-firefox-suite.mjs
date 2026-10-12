// Copyright © 2026 Mcont.

import process from "node:process";

import { runSuiteReport, selfTestSuiteReport } from "./test-suite-report.mjs";

/**
 * Writes the Firefox transport release report.
 *
 * The suite runs inside Firefox. A Chromium result cannot satisfy this report.
 */
async function reportFirefoxSuite() {
  await runSuiteReport({
    suite: "firefox",
    config: "vitest.firefox-transport.ts",
  });
}

const argument = process.argv[2];

if (process.argv.length > 3 || (argument !== undefined && argument !== "--self-test")) {
  throw new Error("Usage: node scripts/report-firefox-suite.mjs [--self-test]");
}

if (argument === "--self-test") {
  selfTestSuiteReport();
} else {
  await reportFirefoxSuite();
}
