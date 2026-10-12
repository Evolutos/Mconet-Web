// Copyright © 2026 Mcont.

import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

/** Promise-based process runner for the repository secret scanner. */
const execFileAsync = promisify(execFile);

/** Workspace root resolved independently from the caller's current directory. */
const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Generated release report. The directory is not committed. */
const reportPath = path.join(workspaceRoot, ".artifacts", "reports", "secrets.json");

/** Existing scanner. This report does not duplicate its detector rules. */
const scannerPath = path.join(workspaceRoot, "scripts", "check-secrets.mjs");

/**
 * Rejects a scan that still has findings.
 *
 * The approved placeholders are already ignored by the scanner, so a remaining
 * finding is an unreviewed credential-shaped value.
 *
 * @param {number} findings Finding count reported by the scanner.
 */
export function assertNoSecretFindings(findings) {
  if (!Number.isInteger(findings) || findings < 0) {
    throw new Error("The secret scan did not report a finding count.");
  }
  if (findings !== 0) {
    throw new Error(`Secret scan report failed with ${findings} finding(s).`);
  }
}

/**
 * Reads the finding count from a failed scanner diagnostic.
 *
 * @param {string} output Combined scanner output.
 * @returns {number} Parsed finding count.
 */
function readFindingCount(output) {
  const match = /Secret scan failed with (\d+) finding\(s\)\./.exec(output);
  if (match?.[1] === undefined) {
    throw new Error("The secret scanner failed without a finding count.");
  }
  return Number(match[1]);
}

/**
 * Runs the repository scanner and writes one secret-scan report.
 */
async function reportSecretScan() {
  await mkdir(path.dirname(reportPath), { recursive: true });
  let findings = 0;
  try {
    await execFileAsync(process.execPath, [scannerPath], {
      cwd: workspaceRoot,
      encoding: "utf8",
      maxBuffer: 8 * 1024 * 1024,
    });
  } catch (error) {
    const stderr = error && typeof error === "object" && "stderr" in error ? error.stderr : "";
    const stdout = error && typeof error === "object" && "stdout" in error ? error.stdout : "";
    const output = `${typeof stderr === "string" ? stderr : ""}\n${typeof stdout === "string" ? stdout : ""}`;
    findings = readFindingCount(output);
  }

  const report = { suite: "secrets", findings };
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`Secret scan report: ${findings} finding(s).\n`);
  assertNoSecretFindings(findings);
}

/**
 * Proves a clean count is accepted and a positive count is rejected.
 */
function selfTest() {
  assertNoSecretFindings(0);
  let rejected = false;
  try {
    assertNoSecretFindings(1);
  } catch (error) {
    rejected = error instanceof Error && error.message.includes("1 finding");
  }
  if (!rejected) {
    throw new Error("Secret scan report self-test did not reject a finding.");
  }
}

const argument = process.argv[2];

if (process.argv.length > 3 || (argument !== undefined && argument !== "--self-test")) {
  throw new Error("Usage: node scripts/report-secret-scan.mjs [--self-test]");
}

if (argument === "--self-test") {
  selfTest();
} else {
  await reportSecretScan();
}
