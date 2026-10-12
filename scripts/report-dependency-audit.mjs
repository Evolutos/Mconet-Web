// Copyright © 2026 Mcont.

import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

/** Promise-based process runner for the locked dependency audit. */
const execFileAsync = promisify(execFile);

/** Workspace root resolved independently from the caller's current directory. */
const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Generated release report. The directory is not committed. */
const reportPath = path.join(workspaceRoot, ".artifacts", "reports", "dependencies.json");

/**
 * Rejects an audit whose high or critical advisory count is not zero.
 *
 * This is the same bar as `pnpm audit --audit-level high`. Moderate and low
 * advisories stay visible in the report and do not block the release.
 *
 * @param {number} blockingIssues High and critical advisory count.
 */
export function assertNoBlockingAdvisories(blockingIssues) {
  if (!Number.isInteger(blockingIssues) || blockingIssues < 0) {
    throw new Error("The dependency audit did not report a blocking advisory count.");
  }
  if (blockingIssues !== 0) {
    throw new Error(
      `Dependency audit report failed with ${blockingIssues} blocking advisory(ies).`,
    );
  }
}

/**
 * Counts high and critical advisories in a pnpm audit document.
 *
 * @param {unknown} report Parsed `pnpm audit --json` document.
 * @returns {{ blockingIssues: number, vulnerabilities: { info: number, low: number, moderate: number, high: number, critical: number } }}
 */
export function readAuditCounts(report) {
  if (typeof report !== "object" || report === null || !("metadata" in report)) {
    throw new Error("The dependency audit did not return a metadata document.");
  }
  const metadata = report.metadata;
  if (typeof metadata !== "object" || metadata === null || !("vulnerabilities" in metadata)) {
    throw new Error("The dependency audit did not return vulnerability counts.");
  }
  const vulnerabilities = metadata.vulnerabilities;
  if (typeof vulnerabilities !== "object" || vulnerabilities === null) {
    throw new Error("The dependency audit vulnerability counts are not an object.");
  }
  const counts = {
    info: readCount(vulnerabilities, "info"),
    low: readCount(vulnerabilities, "low"),
    moderate: readCount(vulnerabilities, "moderate"),
    high: readCount(vulnerabilities, "high"),
    critical: readCount(vulnerabilities, "critical"),
  };
  return {
    blockingIssues: counts.high + counts.critical,
    vulnerabilities: counts,
  };
}

/**
 * Reads one non-negative integer severity count.
 *
 * @param {object} vulnerabilities Severity map from pnpm.
 * @param {"info" | "low" | "moderate" | "high" | "critical"} severity Severity name.
 * @returns {number} Count for that severity.
 */
function readCount(vulnerabilities, severity) {
  const count = vulnerabilities[severity];
  if (!Number.isInteger(count) || count < 0) {
    throw new Error(`The dependency audit did not return a ${severity} count.`);
  }
  return count;
}

/**
 * Runs `pnpm audit --json` and returns its document text.
 *
 * pnpm exits non-zero when any advisory exists, including low and moderate.
 * Those severities are not blocking, so a JSON document on stdout is still a
 * completed audit. A failure without JSON is a broken audit.
 *
 * @returns {Promise<string>} Audit document text.
 */
async function readAuditDocument() {
  try {
    const { stdout } = await execFileAsync("pnpm", ["audit", "--json"], {
      cwd: workspaceRoot,
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
    });
    return String(stdout);
  } catch (error) {
    const stdout = error && typeof error === "object" && "stdout" in error ? error.stdout : "";
    if (typeof stdout === "string" && stdout.trimStart().startsWith("{")) {
      return stdout;
    }
    throw error;
  }
}

/** Runs `pnpm audit` and writes one vulnerability report. */
async function reportDependencyAudit() {
  await mkdir(path.dirname(reportPath), { recursive: true });
  const counts = readAuditCounts(JSON.parse(await readAuditDocument()));
  await writeFile(reportPath, `${JSON.stringify({ suite: "dependencies", ...counts }, null, 2)}\n`);
  process.stdout.write(
    `Dependency audit report: ${counts.blockingIssues} blocking advisory(ies).\n`,
  );
  assertNoBlockingAdvisories(counts.blockingIssues);
}

/** Proves high and critical advisories block, and lower severities do not. */
function selfTestDependencyAudit() {
  const clean = readAuditCounts({
    metadata: { vulnerabilities: { info: 0, low: 1, moderate: 2, high: 0, critical: 0 } },
  });
  if (clean.blockingIssues !== 0) {
    throw new Error("Dependency audit self-test treated a lower severity as blocking.");
  }
  assertNoBlockingAdvisories(clean.blockingIssues);
  const blocking = readAuditCounts({
    metadata: { vulnerabilities: { info: 0, low: 0, moderate: 0, high: 1, critical: 1 } },
  });
  if (blocking.blockingIssues !== 2) {
    throw new Error("Dependency audit self-test failed to add high and critical advisories.");
  }
  let rejected = false;
  try {
    assertNoBlockingAdvisories(blocking.blockingIssues);
  } catch (error) {
    rejected = error instanceof Error && error.message.includes("2 blocking advisory");
  }
  if (!rejected) {
    throw new Error("Dependency audit self-test failed to reject a blocking advisory.");
  }
  process.stdout.write("Dependency audit self-test passed.\n");
}

/** Parses command arguments and runs either the audit report or its self-test. */
async function main() {
  const [argument, ...unexpectedArguments] = process.argv.slice(2);
  if (unexpectedArguments.length > 0 || (argument && argument !== "--self-test")) {
    throw new Error("Usage: node scripts/report-dependency-audit.mjs [--self-test]");
  }
  if (argument === "--self-test") {
    selfTestDependencyAudit();
    return;
  }
  await reportDependencyAudit();
}

try {
  await main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}
