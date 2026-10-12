// Copyright © 2026 Mcont.

import process from "node:process";

import { runSuiteReport, selfTestSuiteReport } from "./test-suite-report.mjs";

/**
 * Writes the concurrency stability report.
 *
 * The name filter keeps the report on overlapping interactions: target
 * identity, credential sources, and abort signals must not cross calls.
 */
async function reportConcurrency() {
  await runSuiteReport({
    suite: "concurrency",
    config: "vitest.workspace.ts",
    testNamePattern: "concurrent",
    files: ["packages/core-runtime/src/execute-unary-interaction.test.ts"],
  });
}

const argument = process.argv[2];

if (process.argv.length > 3 || (argument !== undefined && argument !== "--self-test")) {
  throw new Error("Usage: node scripts/report-concurrency.mjs [--self-test]");
}

if (argument === "--self-test") {
  selfTestSuiteReport();
} else {
  await reportConcurrency();
}
