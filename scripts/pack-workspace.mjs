// Copyright © 2026 Mcont.

import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { promisify } from "node:util";

/** Promise-based process runner used for deterministic pnpm pack calls. */
const execFileAsync = promisify(execFile);

/** Workspace root resolved independently from the caller's current directory. */
const workspaceRoot = path.resolve(import.meta.dirname, "..");

/** Directory containing every publishable workspace package. */
const packagesRoot = path.join(workspaceRoot, "packages");

/** Clean output directory for generated package tarballs. */
const artifactRoot = path.join(workspaceRoot, ".artifacts", "packages");

/** Portable pnpm executable name for the current platform. */
const pnpmExecutable = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

/**
 * Narrows parsed JSON to a non-null record.
 *
 * @param {unknown} value Value read from a manifest or pnpm output.
 * @returns {value is Record<string, unknown>} Whether the value is a record.
 */
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Parses JSON and attaches the owning file or command to syntax failures.
 *
 * @param {string} source JSON source text.
 * @param {string} context Human-readable source context.
 * @returns {unknown} Parsed JSON value requiring explicit narrowing.
 */
function parseJson(source, context) {
  try {
    return JSON.parse(source);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid JSON from ${context}: ${message}`, { cause: error });
  }
}

/**
 * Collects package-relative dist targets from a nested exports value.
 *
 * @param {unknown} value Current exports node.
 * @param {Set<string>} targets Accumulated package-relative target paths.
 */
function collectDistExportTargets(value, targets) {
  if (typeof value === "string") {
    if (value.startsWith("./dist/")) {
      targets.add(value.slice(2));
    }
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  for (const nestedValue of Object.values(value)) {
    collectDistExportTargets(nestedValue, targets);
  }
}

/**
 * Reads and validates the packaging contract for one package manifest.
 *
 * @param {string} packageRole Workspace package directory name.
 * @returns {Promise<{name: string, targets: ReadonlySet<string>}>} Package name and export targets.
 */
async function readPackageContract(packageRole) {
  const manifestPath = path.join(packagesRoot, packageRole, "package.json");
  const manifest = parseJson(await fs.readFile(manifestPath, "utf8"), manifestPath);
  if (!isRecord(manifest) || typeof manifest.name !== "string") {
    throw new Error(`Package manifest has no valid name: ${manifestPath}`);
  }
  if (
    !Array.isArray(manifest.files) ||
    manifest.files.length !== 1 ||
    manifest.files[0] !== "dist"
  ) {
    throw new Error(`Package '${manifest.name}' must publish only its dist directory.`);
  }

  const targets = new Set();
  collectDistExportTargets(manifest.exports, targets);
  if (targets.size === 0) {
    throw new Error(`Package '${manifest.name}' has no dist export targets.`);
  }

  return { name: manifest.name, targets };
}

/**
 * Validates pnpm's machine-readable pack report for one package.
 *
 * @param {string} output Raw pnpm JSON output.
 * @param {string} packageName Expected package name.
 * @param {ReadonlySet<string>} exportTargets Required dist files.
 */
function validatePackReport(output, packageName, exportTargets) {
  const report = parseJson(output, `pnpm pack for '${packageName}'`);
  if (!isRecord(report) || report.name !== packageName || !Array.isArray(report.files)) {
    throw new Error(`Invalid pnpm pack report for '${packageName}'.`);
  }

  const packedFiles = new Set(
    report.files.flatMap((file) =>
      isRecord(file) && typeof file.path === "string" ? [file.path] : [],
    ),
  );
  if (!packedFiles.has("package.json")) {
    throw new Error(`Package '${packageName}' tarball does not contain package.json.`);
  }

  for (const exportTarget of exportTargets) {
    if (!packedFiles.has(exportTarget)) {
      throw new Error(`Package '${packageName}' tarball is missing '${exportTarget}'.`);
    }
  }
}

/**
 * Packs and validates one workspace package into the shared artifact directory.
 *
 * @param {string} packageRole Workspace package directory name.
 */
async function packPackage(packageRole) {
  const packageRoot = path.join(packagesRoot, packageRole);
  const { name, targets } = await readPackageContract(packageRole);
  const outputPattern = path.join(artifactRoot, "%s-%v.tgz");
  const { stdout } = await execFileAsync(
    pnpmExecutable,
    ["pack", "--json", "--out", outputPattern],
    { cwd: packageRoot, maxBuffer: 1024 * 1024 },
  );

  validatePackReport(stdout, name, targets);
  process.stdout.write(`Packed and validated ${name}.\n`);
}

/** Packs every workspace package and rejects missing or extra tarballs. */
async function main() {
  const packageEntries = await fs.readdir(packagesRoot, { withFileTypes: true });
  const packageRoles = packageEntries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  await fs.rm(artifactRoot, { force: true, recursive: true });
  await fs.mkdir(artifactRoot, { recursive: true });

  for (const packageRole of packageRoles) {
    await packPackage(packageRole);
  }

  const artifacts = (await fs.readdir(artifactRoot)).filter((name) => name.endsWith(".tgz"));
  if (artifacts.length !== packageRoles.length) {
    throw new Error(`Expected ${packageRoles.length} tarballs but found ${artifacts.length}.`);
  }

  process.stdout.write(`Validated ${artifacts.length} package tarballs.\n`);
}

await main();
