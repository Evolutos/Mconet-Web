// Copyright © 2026 Mcont.

import { execFile } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

/** Promise-based process runner for the Vitest CLI. */
const execFileAsync = promisify(execFile);

/** Workspace root resolved independently from the caller's current directory. */
const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Directory that holds one generated report per suite. The directory is not committed. */
const reportRoot = path.join(workspaceRoot, ".artifacts", "reports");

/** Local Vitest entry so the report does not invoke a package-manager install. */
const vitestEntry = path.join(workspaceRoot, "node_modules", "vitest", "vitest.mjs");

/** Output cap for Vitest diagnostics. The JSON report itself is written to disk. */
const VITEST_OUTPUT_LIMIT_BYTES = 16 * 1024 * 1024;

/**
 * @typedef {object} SuiteReport
 * @property {string} suite Stable suite name.
 * @property {number} passed Tests that passed.
 * @property {number} failed Tests that failed.
 * @property {number} files Test files Vitest executed.
 * @property {readonly string[]} failures Failed test names.
 */

/**
 * Narrows parsed JSON to a non-null record.
 *
 * @param {unknown} value Parsed reporter value.
 * @returns {value is Record<string, unknown>} Whether the value is a record.
 */
function isRecord(value) {
  // Reporter JSON excludes null and arrays even though both are objects.
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Reads a non-negative integer field from the Vitest reporter.
 *
 * @param {Record<string, unknown>} report Parsed Vitest JSON.
 * @param {string} field Field name.
 * @returns {number} Field value.
 */
function readCount(report, field) {
  const value = report[field];
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new Error(`The Vitest report is missing a usable ${field} count.`);
  }
  return value;
}

/**
 * Collects failed test names from a Jest-compatible Vitest JSON report.
 *
 * @param {unknown} testResults Reporter file list.
 * @returns {string[]} Failed test names in reporter order.
 */
function readFailures(testResults) {
  if (!Array.isArray(testResults)) {
    throw new Error("The Vitest report is missing its file list.");
  }

  /** @type {string[]} */
  const failures = [];
  for (const fileResult of testResults) {
    if (!isRecord(fileResult) || !Array.isArray(fileResult.assertionResults)) {
      throw new Error("The Vitest report contains a file without assertion results.");
    }
    const fileName = typeof fileResult.name === "string" ? fileResult.name : "unknown file";
    for (const assertion of fileResult.assertionResults) {
      if (!isRecord(assertion) || assertion.status !== "failed") {
        continue;
      }
      const testName = typeof assertion.fullName === "string" ? assertion.fullName : "unknown test";
      failures.push(`${fileName}: ${testName}`);
    }
  }
  return failures;
}

/**
 * Reduces a Vitest JSON report to the single suite summary.
 *
 * A suite with no passing tests is rejected. `passWithNoTests` can hide an
 * empty include pattern, which is not a completed release run.
 *
 * @param {string} suite Stable suite name.
 * @param {unknown} report Parsed Vitest JSON.
 * @returns {SuiteReport} Summary that is safe to store.
 */
export function summarizeSuiteReport(suite, report) {
  if (!isRecord(report)) {
    throw new Error("The Vitest report must be a JSON object.");
  }

  const passed = readCount(report, "numPassedTests");
  const failed = readCount(report, "numFailedTests");
  const files = readCount(report, "numTotalTestSuites");
  const failures = readFailures(report.testResults);

  if (passed === 0) {
    throw new Error(`The ${suite} suite did not pass any tests.`);
  }
  if (failed !== failures.length) {
    throw new Error(
      `The ${suite} suite reported ${failed} failures but listed ${failures.length}.`,
    );
  }

  return { suite, passed, failed, files, failures };
}

/**
 * Rejects a summary that still contains failures.
 *
 * @param {SuiteReport} summary Reduced suite summary.
 */
export function assertSuitePassed(summary) {
  if (summary.failed !== 0) {
    const failureText = summary.failures.length > 0 ? `\n${summary.failures.join("\n")}` : "";
    throw new Error(`The ${summary.suite} suite did not pass.${failureText}`);
  }
}

/**
 * Runs one Vitest config and writes a single JSON summary.
 *
 * @param {{ suite: string, config: string, files?: readonly string[] }} options Suite name, Vitest config, and optional file filter.
 * @returns {Promise<SuiteReport>} Summary written under `.artifacts/reports`.
 */
export async function runSuiteReport(options) {
  await mkdir(reportRoot, { recursive: true });
  const rawReportPath = path.join(reportRoot, `${options.suite}.vitest.json`);
  const summaryPath = path.join(reportRoot, `${options.suite}.json`);

  let vitestFailed = false;
  try {
    await execFileAsync(
      process.execPath,
      [
        vitestEntry,
        "run",
        "--config",
        options.config,
        "--reporter=json",
        `--outputFile=${rawReportPath}`,
        ...(options.files ?? []),
      ],
      {
        cwd: workspaceRoot,
        encoding: "utf8",
        maxBuffer: VITEST_OUTPUT_LIMIT_BYTES,
      },
    );
  } catch (error) {
    // Keep the reporter file. A failing suite still owes the release a summary.
    vitestFailed = true;
    if (!isRecord(error) || !("code" in error)) {
      throw error;
    }
  }

  /** @type {unknown} */
  const rawReport = JSON.parse(await readFile(rawReportPath, "utf8"));
  const summary = summarizeSuiteReport(options.suite, rawReport);
  await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
  await rm(rawReportPath, { force: true });

  process.stdout.write(
    `${summary.suite} report: ${summary.passed} passed, ${summary.failed} failed, ${summary.files} files.\n`,
  );

  if (vitestFailed || !isRecord(rawReport) || rawReport.success !== true) {
    assertSuitePassed(summary);
    throw new Error(`The ${options.suite} suite exited without a successful Vitest result.`);
  }

  assertSuitePassed(summary);

  return summary;
}

/**
 * Proves the summary accepts a green report and rejects a failure or an empty run.
 */
export function selfTestSuiteReport() {
  const passed = summarizeSuiteReport("unit", {
    numPassedTests: 2,
    numFailedTests: 0,
    numTotalTestSuites: 1,
    success: true,
    testResults: [
      {
        name: "example.test.ts",
        assertionResults: [
          { fullName: "keeps the value", status: "passed" },
          { fullName: "rejects a blank value", status: "passed" },
        ],
      },
    ],
  });
  if (passed.passed !== 2 || passed.failed !== 0) {
    throw new Error("Suite report self-test miscounted a passing run.");
  }

  let rejectedFailure = false;
  try {
    assertSuitePassed(
      summarizeSuiteReport("unit", {
        numPassedTests: 1,
        numFailedTests: 1,
        numTotalTestSuites: 1,
        success: false,
        testResults: [
          {
            name: "example.test.ts",
            assertionResults: [{ fullName: "rejects a blank value", status: "failed" }],
          },
        ],
      }),
    );
  } catch (error) {
    rejectedFailure = error instanceof Error && error.message.includes("did not pass");
  }
  if (!rejectedFailure) {
    throw new Error("Suite report self-test did not reject a failed test.");
  }

  let rejectedEmptyRun = false;
  try {
    summarizeSuiteReport("unit", {
      numPassedTests: 0,
      numFailedTests: 0,
      numTotalTestSuites: 0,
      success: true,
      testResults: [],
    });
  } catch (error) {
    rejectedEmptyRun = error instanceof Error && error.message.includes("did not pass any tests");
  }
  if (!rejectedEmptyRun) {
    throw new Error("Suite report self-test did not reject an empty run.");
  }
}
