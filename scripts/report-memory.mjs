// Copyright © 2026 Mcont.

import process from "node:process";

import { runSuiteReport, selfTestSuiteReport } from "./test-suite-report.mjs";

/** Node flag required before the repeated-interaction test can collect garbage. */
const EXPOSE_GC = "--expose-gc";

/**
 * Writes the retained-heap stability report.
 *
 * Vitest inherits this process environment, so the worker can call `gc` and
 * compare heap samples. The test fails when retained memory keeps climbing.
 */
async function reportMemory() {
  const currentOptions = process.env.NODE_OPTIONS ?? "";
  if (!currentOptions.includes(EXPOSE_GC)) {
    process.env.NODE_OPTIONS = `${currentOptions} ${EXPOSE_GC}`.trim();
  }

  await runSuiteReport({
    suite: "memory",
    config: "vitest.workspace.ts",
    testNamePattern: "retained heap",
    files: ["packages/core-runtime/src/execute-unary-interaction.test.ts"],
  });
}

const argument = process.argv[2];

if (process.argv.length > 3 || (argument !== undefined && argument !== "--self-test")) {
  throw new Error("Usage: node scripts/report-memory.mjs [--self-test]");
}

if (argument === "--self-test") {
  selfTestSuiteReport();
} else {
  await reportMemory();
}
