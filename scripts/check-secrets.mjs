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

const excludedPathPrefixes = [".git/", ".artifacts/", "coverage/", "node_modules/"];

/**
 * Returns tracked and non-ignored untracked files. Scanning both sets catches a
 * leak before it is staged while preserving the repository's ignore contract.
 *
 * @returns {string[]}
 */
function listRepositoryFiles() {
  const output = execFileSync(
    "git",
    ["ls-files", "-z", "--cached", "--others", "--exclude-standard"],
    {
      cwd: workspaceRoot,
      encoding: "buffer",
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

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
  const normalizedPath = relativePath.split(path.sep).join("/");

  if (path.isAbsolute(relativePath) || normalizedPath.startsWith("../")) {
    throw new Error(`Refusing to scan a path outside the workspace: ${relativePath}`);
  }

  return (
    !excludedPathPrefixes.some((prefix) => normalizedPath.startsWith(prefix)) &&
    !normalizedPath.includes("/dist/") &&
    !normalizedPath.endsWith("/dist")
  );
}

/**
 * Finds potential secrets without retaining or printing their values.
 *
 * @param {string} text
 * @param {string} relativePath
 * @returns {{ path: string; line: number; column: number; ruleId: string }[]}
 */
function scanText(text, relativePath) {
  const findings = [];

  for (const rule of secretRules) {
    rule.pattern.lastIndex = 0;

    for (const match of text.matchAll(rule.pattern)) {
      const detectedValue = match[rule.valueGroup ?? 0];

      if (approvedCredentialValues.has(detectedValue)) {
        continue;
      }

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
  const findings = [];

  for (const relativePath of listRepositoryFiles()) {
    const content = readFileSync(path.join(workspaceRoot, relativePath));

    if (content.includes(0)) {
      continue;
    }

    findings.push(...scanText(content.toString("utf8"), relativePath));
  }

  return findings;
}

/**
 * Exercises every detector with a runtime-generated value. Keeping the samples
 * assembled in memory prevents realistic secret-shaped fixtures from entering Git.
 */
function runSelfTest() {
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

  for (const [ruleId, sample] of generatedSamples) {
    const findings = scanText(sample, "generated-security-input");

    if (!findings.some((finding) => finding.ruleId === ruleId)) {
      throw new Error(`Secret detector self-test failed: ${ruleId}`);
    }
  }

  const approvedInput = [
    'const credential = "TEST_ONLY_DO_NOT_USE";',
    'const secret = "[REDACTED]";',
  ].join("\n");

  if (scanText(approvedInput, "approved-placeholder-input").length > 0) {
    throw new Error("Secret detector self-test rejected an approved placeholder.");
  }

  writeLog(`Secret detector self-test passed (${secretRules.length} rules).`);
}

function main() {
  const [argument, ...unexpectedArguments] = process.argv.slice(2);

  if (unexpectedArguments.length > 0 || (argument && argument !== "--self-test")) {
    throw new Error("Usage: node scripts/check-secrets.mjs [--self-test]");
  }

  if (argument === "--self-test") {
    runSelfTest();
    return;
  }

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

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  writeError(message);
  process.exitCode = 1;
}
