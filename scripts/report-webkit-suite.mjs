// Copyright © 2026 Mcont.

import process from "node:process";

import { runSuiteReport, selfTestSuiteReport } from "./test-suite-report.mjs";

/**
 * Writes the WebKit transport release report.
 *
 * The suite runs inside WebKit. A Chromium or Firefox result cannot satisfy
 * this report.
 */
async function reportWebkitSuite() {
  await runSuiteReport({
    suite: "webkit",
    config: "vitest.webkit-transport.ts",
  });
}

const argument = process.argv[2];

if (process.argv.length > 3 || (argument !== undefined && argument !== "--self-test")) {
  throw new Error("Usage: node scripts/report-webkit-suite.mjs [--self-test]");
}

if (argument === "--self-test") {
  selfTestSuiteReport();
} else {
  await reportWebkitSuite();
}
