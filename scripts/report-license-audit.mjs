// Copyright © 2026 Mcont.

import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

/** Promise-based process runner for the existing license checker. */
const execFileAsync = promisify(execFile);

/** Workspace root resolved independently from the caller's current directory. */
const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Generated release report. The directory is not committed. */
const reportPath = path.join(workspaceRoot, ".artifacts", "reports", "licenses.json");

/** Existing checker. This report does not keep a second license allow-list. */
const checkerPath = path.join(workspaceRoot, "scripts", "check-licenses.mjs");

/**
 * Rejects an audit that still has blocking license issues.
 *
 * A blocking issue is an unreviewed license expression, or a checker failure
 * that could not prove the installed graph is reviewed.
 *
 * @param {number} blockingIssues Blocking issue count.
 */
export function assertNoBlockingLicenseIssues(blockingIssues) {
  if (!Number.isInteger(blockingIssues) || blockingIssues < 0) {
    throw new Error("The license audit did not report a blocking issue count.");
  }
  if (blockingIssues !== 0) {
    throw new Error(`License audit report failed with ${blockingIssues} blocking issue(s).`);
  }
}

/**
 * Counts unreviewed license expressions in a failed checker diagnostic.
 *
 * Any other checker failure is one blocking issue. An empty failure must not
 * look like a clean audit.
 *
 * @param {string} output Combined checker output.
 * @returns {number} Blocking issue count.
 */
export function readBlockingLicenseIssues(output) {
  const match = /License review required for ([^\n]+)/.exec(output);
  if (match?.[1] === undefined) {
    return 1;
  }
  const expressions = match[1]
    .split("; ")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  return expressions.length === 0 ? 1 : expressions.length;
}

/**
 * Reads the reviewed summary from a successful checker report.
 *
 * @param {string} output Checker stdout.
 * @returns {{ totalPackageVersions: number, expressions: { license: string, packageVersions: number }[] }}
 */
function readLicenseSummary(output) {
  const summary =
    /License audit report: (\d+) package version\(s\) across (\d+) reviewed license expression\(s\)\./.exec(
      output,
    );
  if (summary?.[1] === undefined || summary[2] === undefined) {
    throw new Error("The license checker succeeded without a summary.");
  }
  const expressions = [...output.matchAll(/^- (.+): (\d+) package version\(s\)$/gm)].map(
    (match) => ({
      license: match[1] ?? "",
      packageVersions: Number(match[2]),
    }),
  );
  if (expressions.length !== Number(summary[2])) {
    throw new Error("The license checker summary does not match its expression rows.");
  }
  return {
    totalPackageVersions: Number(summary[1]),
    expressions,
  };
}

/** Runs the license checker and writes one audit report. */
async function reportLicenseAudit() {
  await mkdir(path.dirname(reportPath), { recursive: true });
  /** @type {{ blockingIssues: number, totalPackageVersions?: number, expressions?: { license: string, packageVersions: number }[] }} */
  let report;
  try {
    const { stdout } = await execFileAsync(process.execPath, [checkerPath], {
      cwd: workspaceRoot,
      encoding: "utf8",
      maxBuffer: 8 * 1024 * 1024,
    });
    const summary = readLicenseSummary(String(stdout));
    report = { blockingIssues: 0, ...summary };
  } catch (error) {
    const stderr = error && typeof error === "object" && "stderr" in error ? error.stderr : "";
    const stdout = error && typeof error === "object" && "stdout" in error ? error.stdout : "";
    const output = `${typeof stderr === "string" ? stderr : ""}\n${typeof stdout === "string" ? stdout : ""}`;
    report = { blockingIssues: readBlockingLicenseIssues(output) };
  }
  await writeFile(reportPath, `${JSON.stringify({ suite: "licenses", ...report }, null, 2)}\n`);
  process.stdout.write(`License audit report: ${report.blockingIssues} blocking issue(s).\n`);
  assertNoBlockingLicenseIssues(report.blockingIssues);
}

/** Proves a clean audit is accepted and an unreviewed expression is counted. */
function selfTestLicenseAudit() {
  assertNoBlockingLicenseIssues(0);
  if (readBlockingLicenseIssues("License review required for GPL-3.0: example@1.0.0") !== 1) {
    throw new Error("License audit self-test failed to count one unreviewed expression.");
  }
  if (
    readBlockingLicenseIssues(
      "License review required for GPL-3.0: example@1.0.0; UNKNOWN: other@2.0.0",
    ) !== 2
  ) {
    throw new Error("License audit self-test failed to count two unreviewed expressions.");
  }
  if (readBlockingLicenseIssues("License report is empty") !== 1) {
    throw new Error("License audit self-test failed to treat a checker failure as blocking.");
  }
  let rejected = false;
  try {
    assertNoBlockingLicenseIssues(1);
  } catch (error) {
    rejected = error instanceof Error && error.message.includes("1 blocking issue");
  }
  if (!rejected) {
    throw new Error("License audit self-test failed to reject a blocking issue.");
  }
  process.stdout.write("License audit self-test passed.\n");
}

/** Parses command arguments and runs either the audit report or its self-test. */
async function main() {
  const [argument, ...unexpectedArguments] = process.argv.slice(2);
  if (unexpectedArguments.length > 0 || (argument && argument !== "--self-test")) {
    throw new Error("Usage: node scripts/report-license-audit.mjs [--self-test]");
  }
  if (argument === "--self-test") {
    selfTestLicenseAudit();
    return;
  }
  await reportLicenseAudit();
}

try {
  await main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}
