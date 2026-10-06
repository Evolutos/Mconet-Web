// Copyright © 2026 Mcont.

import { execFileSync } from "node:child_process";
import { error as writeError, log as writeLog } from "node:console";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * License expressions reviewed for the current dependency policy. Exact matching
 * makes every newly introduced expression require an explicit policy decision.
 */
const reviewedLicenseExpressions = new Set([
  "Apache-2.0",
  "BlueOak-1.0.0",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "ISC",
  "MIT",
  "MPL-2.0",
]);

/**
 * Collects the complete installed dependency license report from the workspace's
 * pinned package manager. Paths remain internal to pnpm and are never printed.
 *
 * @returns {unknown}
 */
function collectLicenseReport() {
  const output = execFileSync("pnpm", ["licenses", "list", "--json"], {
    cwd: workspaceRoot,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });

  return JSON.parse(output);
}

/**
 * Validates pnpm's report shape and produces a deterministic, path-free summary.
 *
 * @param {unknown} report
 * @returns {{ rows: { license: string; packageVersions: string[] }[]; totalPackageVersions: number }}
 */
function evaluateLicenseReport(report) {
  if (!report || typeof report !== "object" || Array.isArray(report)) {
    throw new Error("License report must be an object grouped by license expression.");
  }

  const reportEntries = Object.entries(report);

  if (reportEntries.length === 0) {
    throw new Error("License report is empty; install dependencies before auditing.");
  }

  const rows = reportEntries
    .sort(([leftLicense], [rightLicense]) => leftLicense.localeCompare(rightLicense))
    .map(([license, packages]) => ({
      license,
      packageVersions: readPackageVersions(license, packages),
    }));

  const unreviewedRows = rows.filter(({ license }) => !reviewedLicenseExpressions.has(license));

  if (unreviewedRows.length > 0) {
    const details = unreviewedRows
      .map(({ license, packageVersions }) => `${license}: ${packageVersions.join(", ")}`)
      .join("; ");

    throw new Error(`License review required for ${details}`);
  }

  return {
    rows,
    totalPackageVersions: rows.reduce(
      (count, { packageVersions }) => count + packageVersions.length,
      0,
    ),
  };
}

/**
 * Extracts sorted package/version identifiers while rejecting incomplete report
 * records. A missing license or version must not silently pass the audit.
 *
 * @param {string} license
 * @param {unknown} packages
 * @returns {string[]}
 */
function readPackageVersions(license, packages) {
  if (!Array.isArray(packages) || packages.length === 0) {
    throw new Error(`License report group ${license} contains no packages.`);
  }

  const packageVersions = [];

  for (const packageRecord of packages) {
    if (!packageRecord || typeof packageRecord !== "object") {
      throw new Error(`License report group ${license} contains an invalid package record.`);
    }

    const { name, versions } = packageRecord;

    if (typeof name !== "string" || name.length === 0) {
      throw new Error(`License report group ${license} contains a package without a name.`);
    }

    if (
      !Array.isArray(versions) ||
      versions.length === 0 ||
      versions.some((version) => typeof version !== "string" || version.length === 0)
    ) {
      throw new Error(`License report entry ${name} contains an invalid version list.`);
    }

    packageVersions.push(...versions.map((version) => `${name}@${version}`));
  }

  return packageVersions.sort((left, right) => left.localeCompare(right));
}

/** Prints the reviewed report without exposing installation paths. */
function printLicenseReport() {
  const summary = evaluateLicenseReport(collectLicenseReport());

  writeLog(
    `License audit report: ${summary.totalPackageVersions} package version(s) across ${summary.rows.length} reviewed license expression(s).`,
  );

  for (const { license, packageVersions } of summary.rows) {
    writeLog(`- ${license}: ${packageVersions.length} package version(s)`);
  }
}

/** Verifies both the accepted and review-required policy branches in memory. */
function runSelfTest() {
  const reviewedReport = {
    MIT: [{ name: "example-package", versions: ["1.0.0"] }],
  };
  const reviewedSummary = evaluateLicenseReport(reviewedReport);

  if (reviewedSummary.totalPackageVersions !== 1) {
    throw new Error("License audit self-test failed to summarize a reviewed license.");
  }

  let rejectedUnreviewedLicense = false;

  try {
    evaluateLicenseReport({
      "UNREVIEWED-LICENSE": [{ name: "example-package", versions: ["1.0.0"] }],
    });
  } catch (error) {
    rejectedUnreviewedLicense =
      error instanceof Error && error.message.startsWith("License review required for ");
  }

  if (!rejectedUnreviewedLicense) {
    throw new Error("License audit self-test failed to reject an unreviewed license.");
  }

  writeLog("License audit self-test passed.");
}

function main() {
  const [argument, ...unexpectedArguments] = process.argv.slice(2);

  if (unexpectedArguments.length > 0 || (argument && argument !== "--self-test")) {
    throw new Error("Usage: node scripts/check-licenses.mjs [--self-test]");
  }

  if (argument === "--self-test") {
    runSelfTest();
    return;
  }

  printLicenseReport();
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  writeError(message);
  process.exitCode = 1;
}
