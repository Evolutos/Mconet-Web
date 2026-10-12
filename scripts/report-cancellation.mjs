// Copyright © 2026 Mcont.

import process from "node:process";

import { runSuiteReport, selfTestSuiteReport } from "./test-suite-report.mjs";

/**
 * Cancellation tests from signal creation through transport and decoding.
 *
 * A caller abort or an expired deadline must win before credential use, body
 * reads, and payload parsing. Timeout stays distinct from caller cancellation.
 */
const cancellationTests = [
  "packages/core-runtime/src/resolve-interaction-signal.test.ts",
  "packages/core-runtime/src/resolve-interaction-deadline.test.ts",
  "packages/transport-fetch-shared/src/bridge-caller-abort-signal.test.ts",
  "packages/transport-fetch-shared/src/bridge-deadline-signal.test.ts",
  "packages/transport-fetch-shared/src/map-fetch-abort-error.test.ts",
  "packages/transport-fetch-node/src/node-fetch-timeout.test.ts",
  "packages/transport-fetch-browser/src/browser-fetch-send.test.ts",
  "packages/codec-json/src/json-payload-encoder.test.ts",
  "packages/codec-json/src/json-success-payload-decoder.test.ts",
  "packages/codec-json/src/json-error-payload-decoder.test.ts",
];

/**
 * Writes the cancellation stability report.
 */
async function reportCancellation() {
  await runSuiteReport({
    suite: "cancellation",
    config: "vitest.workspace.ts",
    files: cancellationTests,
  });
}

const argument = process.argv[2];

if (process.argv.length > 3 || (argument !== undefined && argument !== "--self-test")) {
  throw new Error("Usage: node scripts/report-cancellation.mjs [--self-test]");
}

if (argument === "--self-test") {
  selfTestSuiteReport();
} else {
  await reportCancellation();
}
