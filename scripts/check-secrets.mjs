// Copyright © 2026 Mcont.

import { execFileSync } from "node:child_process";
import { error as writeError, log as writeLog } from "node:console";
import { readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const approvedCredentialValues = new Set(["TEST_ONLY_DO_NOT_USE", "[REDACTED]"]);

/**
 * Each detector targets a credential format that should never be committed.
 * Expressions stay deliberately readable so future rule changes remain reviewable.
 */
const secretRules = [
  {
    id: "aws-access-key-id",
    pattern: /\bAKIA[0-9A-Z]{16}\b/g,
  },
  {
    id: "private-key-header",
    pattern: /-----BEGIN[ \t]+(?:RSA[ \t]+|EC[ \t]+|OPENSSH[ \t]+)?PRIVATE[ \t]+KEY-----/g,
  },
  {
    id: "github-token",
    pattern: /\b(?:gh[pousr]_[A-Za-z0-9]{36,255}|github_pat_[A-Za-z0-9_]{60,255})\b/g,
  },
  {
    id: "provider-api-key",
    pattern: /\bsk-[A-Za-z0-9_-]{20,255}\b/g,
  },
  {
    id: "google-api-key",
    pattern: /\bAIza[A-Za-z0-9_-]{35}\b/g,
  },
  {
    id: "slack-token",
    pattern: /\bxox[baprs]-[A-Za-z0-9-]{20,255}\b/g,
  },
  {
    id: "jwt",
    pattern: /\beyJ[A-Za-z0-9_-]{7,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
  },
  {
    id: "credential-assignment",
    pattern:
      /\b(?:api[_-]?key|secret|token|password|credential)\b\s*[:=]\s*["'`]([^"'`\r\n]{12,})["'`]/gi,
    valueGroup: 1,
  },
];

/** Directory names containing generated output, dependencies, or Git metadata. */
const excludedDirectoryNames = new Set([
  ".artifacts",
  ".git",
  ".pnpm-store",
  "coverage",
  "dist",
  "node_modules",
]);

/**
 * Returns tracked and non-ignored untracked files. Scanning both sets catches a
 * leak before it is staged while preserving the repository's ignore contract.
 *
 * @returns {string[]}
 */
function listRepositoryFiles() {
  // Ask Git for cached and non-ignored untracked paths in NUL-delimited form so
  // unusual filenames cannot corrupt list boundaries.
  const output = execFileSync(
    "git",
    ["ls-files", "-z", "--cached", "--others", "--exclude-standard"],
    {
      cwd: workspaceRoot,
      encoding: "buffer",
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  // Decode once, discard the terminal empty field, and apply the reviewed path
  // filter before any file content is opened.
  return output.toString("utf8").split("\0").filter(Boolean).filter(shouldScanPath);
}

/**
 * Excludes only generated or dependency directories. Source and documentation
 * are intentionally not broadly excluded because both can leak credentials.
 *
 * @param {string} relativePath
 * @returns {boolean}
 */
function shouldScanPath(relativePath) {
  // Normalize separators for platform-independent prefix checks while retaining
  // the original relative path for filesystem access and diagnostics.
  const normalizedPath = relativePath.split(path.sep).join("/");

  // Never permit Git output or a crafted caller value to escape the workspace.
  if (path.isAbsolute(relativePath) || normalizedPath.startsWith("../")) {
    throw new Error(`Refusing to scan a path outside the workspace: ${relativePath}`);
  }

  // Check every directory segment instead of only repository-root prefixes.
  // Workspace package dependencies create nested node_modules symlinks, and
  // attempting to read those directory entries as files would fail the scan.
  const directorySegments = normalizedPath.split("/").slice(0, -1);
  return !directorySegments.some((segment) => excludedDirectoryNames.has(segment));
}

/**
 * Finds potential secrets without retaining or printing their values.
 *
 * @param {string} text
 * @param {string} relativePath
 * @returns {{ path: string; line: number; column: number; ruleId: string }[]}
 */
function scanText(text, relativePath) {
  // Findings intentionally retain only location and rule identity, never the
  // detected credential-shaped value.
  const findings = [];

  for (const rule of secretRules) {
    // Global expressions are stateful, so reset each rule before scanning a new
    // text buffer to guarantee deterministic matches.
    rule.pattern.lastIndex = 0;

    for (const match of text.matchAll(rule.pattern)) {
      const detectedValue = match[rule.valueGroup ?? 0];

      // Explicit placeholders are safe test/documentation values and do not
      // produce findings even when their surrounding syntax matches a rule.
      if (approvedCredentialValues.has(detectedValue)) {
        continue;
      }

      // Convert the match offset without storing or printing the matched text.
      const location = locateMatch(text, match.index);
      findings.push({
        path: relativePath,
        line: location.line,
        column: location.column,
        ruleId: rule.id,
      });
    }
  }

  return findings;
}

/**
 * Converts a zero-based string offset into a one-based source location.
 *
 * @param {string} text
 * @param {number} offset
 * @returns {{ line: number; column: number }}
 */
function locateMatch(text, offset) {
  // Count complete preceding lines and locate the final newline in the same
  // prefix so both resulting coordinates are one-based.
  const precedingText = text.slice(0, offset);
  const line = precedingText.split("\n").length;
  const previousLineBreak = precedingText.lastIndexOf("\n");

  return {
    line,
    column: offset - previousLineBreak,
  };
}

/**
 * Reads repository text files and skips binary files identified by a NUL byte.
 * Read failures remain fatal so a file cannot silently escape the security gate.
 *
 * @returns {{ path: string; line: number; column: number; ruleId: string }[]}
 */
function scanRepository() {
  // Aggregate all findings so one run reports the complete remediation set.
  const findings = [];

  for (const relativePath of listRepositoryFiles()) {
    // Read raw bytes first; a NUL byte classifies the file as binary and avoids
    // lossy text decoding or meaningless credential matches.
    const content = readFileSync(path.join(workspaceRoot, relativePath));

    if (content.includes(0)) {
      continue;
    }

    // Decode reviewed text files as UTF-8 and append only redacted locations.
    findings.push(...scanText(content.toString("utf8"), relativePath));
  }

  return findings;
}

/**
 * Exercises every detector with a runtime-generated value. Keeping the samples
 * assembled in memory prevents realistic secret-shaped fixtures from entering Git.
 */
function runSelfTest() {
  // Assemble realistic detector inputs only in memory so the repository never
  // contains committed strings that resemble live credentials.
  const generatedSamples = new Map([
    ["aws-access-key-id", ["AK", "IA", "A".repeat(16)].join("")],
    ["private-key-header", ["-----BEGIN", "PRIVATE KEY-----"].join(" ")],
    ["github-token", ["gh", "p_", "A".repeat(36)].join("")],
    ["provider-api-key", ["s", "k-", "A".repeat(24)].join("")],
    ["google-api-key", ["AI", "za", "A".repeat(35)].join("")],
    ["slack-token", ["xo", "xb-", "1".repeat(12), "-", "A".repeat(24)].join("")],
    ["jwt", ["ey" + "J" + "A".repeat(10), "B".repeat(12), "C".repeat(12)].join(".")],
    ["credential-assignment", `const apiKey = "${"A".repeat(24)}";`],
  ]);

  // Every rule must independently recognize its generated positive sample.
  for (const [ruleId, sample] of generatedSamples) {
    const findings = scanText(sample, "generated-security-input");

    if (!findings.some((finding) => finding.ruleId === ruleId)) {
      throw new Error(`Secret detector self-test failed: ${ruleId}`);
    }
  }

  // Approved placeholders exercise the false-positive escape hatch separately
  // from the positive detector loop.
  const approvedInput = [
    'const credential = "TEST_ONLY_DO_NOT_USE";',
    'const secret = "[REDACTED]";',
  ].join("\n");

  if (scanText(approvedInput, "approved-placeholder-input").length > 0) {
    throw new Error("Secret detector self-test rejected an approved placeholder.");
  }

  // Dependency and generated-output directories must be excluded at both the
  // workspace root and package depth, while ordinary source remains scannable.
  const pathFilterCases = [
    ["node_modules/package/index.js", false],
    ["packages/core-spi/node_modules/package/index.js", false],
    ["packages/core-spi/dist/index.js", false],
    [".pnpm-store/v11/index.db", false],
    ["packages/core-spi/src/credential-source.ts", true],
  ];
  for (const [relativePath, expectedResult] of pathFilterCases) {
    // Compare each reviewed path classification explicitly so a future filter
    // change cannot silently reintroduce directory reads or skip source files.
    if (shouldScanPath(relativePath) !== expectedResult) {
      throw new Error(`Secret path filter self-test failed: ${relativePath}`);
    }
  }

  writeLog(`Secret detector self-test passed (${secretRules.length} rules).`);
}

/** Parses command arguments and runs either repository scanning or self-tests. */
function main() {
  // Accept at most one reviewed switch; unknown or additional arguments fail
  // before reading repository content.
  const [argument, ...unexpectedArguments] = process.argv.slice(2);

  if (unexpectedArguments.length > 0 || (argument && argument !== "--self-test")) {
    throw new Error("Usage: node scripts/check-secrets.mjs [--self-test]");
  }

  // Self-test mode exercises rule behavior without scanning workspace files.
  if (argument === "--self-test") {
    runSelfTest();
    return;
  }

  // Normal mode scans the full reviewed file set and reports every redacted
  // finding before returning a single failing command result.
  const findings = scanRepository();

  if (findings.length > 0) {
    for (const finding of findings) {
      writeError(
        `${finding.path}:${finding.line}:${finding.column} [${finding.ruleId}] potential secret detected; match=[REDACTED]`,
      );
    }

    throw new Error(`Secret scan failed with ${findings.length} finding(s).`);
  }

  writeLog("Secret scan passed.");
}

// Convert every expected or unexpected failure into a concise CLI diagnostic
// while retaining a non-zero process result for automation.
try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  writeError(message);
  process.exitCode = 1;
}
