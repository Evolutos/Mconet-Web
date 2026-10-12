// Copyright © 2026 Mcont.

import process from "node:process";

import { runSuiteReport, selfTestSuiteReport } from "./test-suite-report.mjs";

/**
 * Body-limit tests that must stop reading when the next byte would exceed the cap.
 *
 * The shared reader, the byte collector, and the Node transport each cancel
 * before another chunk is consumed.
 */
const responseLimitTests = [
  "packages/codec-json/src/collect-bounded-bytes.test.ts",
  "packages/transport-fetch-shared/src/read-bounded-fetch-response-body.test.ts",
  "packages/transport-fetch-node/src/node-fetch-body-limit.test.ts",
];

/**
 * Writes the response-limit security report.
 */
async function reportResponseLimit() {
  await runSuiteReport({
    suite: "response-limit",
    config: "vitest.workspace.ts",
    files: responseLimitTests,
  });
}

const argument = process.argv[2];

if (process.argv.length > 3 || (argument !== undefined && argument !== "--self-test")) {
  throw new Error("Usage: node scripts/report-response-limit.mjs [--self-test]");
}

if (argument === "--self-test") {
  selfTestSuiteReport();
} else {
  await reportResponseLimit();
}
