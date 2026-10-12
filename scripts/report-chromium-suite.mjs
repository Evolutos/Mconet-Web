// Copyright © 2026 Mcont.

import process from "node:process";

import { runSuiteReport, selfTestSuiteReport } from "./test-suite-report.mjs";

/**
 * Writes the Chromium transport release report.
 *
 * Firefox and WebKit stay on their own commands so one browser cannot stand
 * in for the others.
 */
async function reportChromiumSuite() {
  await runSuiteReport({
    suite: "chromium",
    config: "vitest.chromium-transport.ts",
  });
}

const argument = process.argv[2];

if (process.argv.length > 3 || (argument !== undefined && argument !== "--self-test")) {
  throw new Error("Usage: node scripts/report-chromium-suite.mjs [--self-test]");
}

if (argument === "--self-test") {
  selfTestSuiteReport();
} else {
  await reportChromiumSuite();
}
