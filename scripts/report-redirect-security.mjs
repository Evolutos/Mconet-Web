// Copyright © 2026 Mcont.

import process from "node:process";

import { runSuiteReport, selfTestSuiteReport } from "./test-suite-report.mjs";

/**
 * Redirect tests that must keep authorization off the next origin.
 *
 * The Node case observes the redirected server. The browser case rejects a
 * following redirect before a request is sent.
 */
const redirectTests = [
  "packages/transport-fetch-node/src/node-fetch-redirect.test.ts",
  "packages/transport-fetch-browser/src/browser-redirect-policy.test.ts",
];

/**
 * Writes the redirect security report.
 */
async function reportRedirectSecurity() {
  await runSuiteReport({
    suite: "redirect",
    config: "vitest.workspace.ts",
    files: redirectTests,
  });
}

const argument = process.argv[2];

if (process.argv.length > 3 || (argument !== undefined && argument !== "--self-test")) {
  throw new Error("Usage: node scripts/report-redirect-security.mjs [--self-test]");
}

if (argument === "--self-test") {
  selfTestSuiteReport();
} else {
  await reportRedirectSecurity();
}
