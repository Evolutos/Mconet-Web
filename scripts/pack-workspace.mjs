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
  // JSON records exclude null and arrays even though both satisfy JavaScript's
  // broad object classification.
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
  // Preserve the parsed value as unknown; callers must narrow the exact contract
  // they require instead of trusting arbitrary command or manifest JSON.
  try {
    return JSON.parse(source);
  } catch (error) {
    // Add source context while retaining the original parser error as the cause.
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
  // String leaves contribute only reviewed package-relative dist targets.
  if (typeof value === "string") {
    if (value.startsWith("./dist/")) {
      targets.add(value.slice(2));
    }
    return;
  }

  // Non-record branches cannot contain nested conditional exports.
  if (!isRecord(value)) {
    return;
  }

  // Traverse every conditional/subpath value recursively; the Set deduplicates
  // targets referenced by multiple conditions.
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
  // Parse the package manifest and require a stable public package name before
  // using it in diagnostics or pack validation.
  const manifestPath = path.join(packagesRoot, packageRole, "package.json");
  const manifest = parseJson(await fs.readFile(manifestPath, "utf8"), manifestPath);
  if (!isRecord(manifest) || typeof manifest.name !== "string") {
    throw new Error(`Package manifest has no valid name: ${manifestPath}`);
  }
  // Publishing is restricted to the dist directory so source and workspace
  // internals cannot leak into generated tarballs.
  if (
    !Array.isArray(manifest.files) ||
    manifest.files.length !== 1 ||
    manifest.files[0] !== "dist"
  ) {
    throw new Error(`Package '${manifest.name}' must publish only its dist directory.`);
  }

  // Recursively collect concrete dist exports and require at least one target,
  // proving the package has a verifiable public artifact contract.
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
  // Parse and narrow pnpm's report before inspecting its file inventory.
  const report = parseJson(output, `pnpm pack for '${packageName}'`);
  if (!isRecord(report) || report.name !== packageName || !Array.isArray(report.files)) {
    throw new Error(`Invalid pnpm pack report for '${packageName}'.`);
  }

  // Keep only valid path records. Malformed entries cannot accidentally satisfy
  // required package or export checks.
  const packedFiles = new Set(
    report.files.flatMap((file) =>
      isRecord(file) && typeof file.path === "string" ? [file.path] : [],
    ),
  );
  // Every npm tarball must carry its manifest independently of export targets.
  if (!packedFiles.has("package.json")) {
    throw new Error(`Package '${packageName}' tarball does not contain package.json.`);
  }

  // Verify every manifest-declared target is physically present in the archive.
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
  // Resolve the package contract before invoking pnpm so validation expectations
  // come from the reviewed manifest rather than command output.
  const packageRoot = path.join(packagesRoot, packageRole);
  const { name, targets } = await readPackageContract(packageRole);
  const outputPattern = path.join(artifactRoot, "%s-%v.tgz");
  // Pack directly into the clean shared artifact root and request structured JSON
  // output for deterministic validation.
  const { stdout } = await execFileAsync(
    pnpmExecutable,
    ["pack", "--json", "--out", outputPattern],
    { cwd: packageRoot, maxBuffer: 1024 * 1024 },
  );

  // Validate required files before reporting package success.
  validatePackReport(stdout, name, targets);
  process.stdout.write(`Packed and validated ${name}.\n`);
}

/** Packs every workspace package and rejects missing or extra tarballs. */
async function main() {
  // Discover directory-backed workspace roles and sort them for deterministic
  // packing order and output.
  const packageEntries = await fs.readdir(packagesRoot, { withFileTypes: true });
  const packageRoles = packageEntries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  // Recreate only the dedicated artifact directory so stale tarballs cannot be
  // mistaken for output from the current run.
  await fs.rm(artifactRoot, { force: true, recursive: true });
  await fs.mkdir(artifactRoot, { recursive: true });

  // Pack sequentially to keep pnpm output and filesystem load predictable.
  for (const packageRole of packageRoles) {
    await packPackage(packageRole);
  }

  // The final tarball count detects missing output and unexpected extras after
  // every package-level content check has passed.
  const artifacts = (await fs.readdir(artifactRoot)).filter((name) => name.endsWith(".tgz"));
  if (artifacts.length !== packageRoles.length) {
    throw new Error(`Expected ${packageRoles.length} tarballs but found ${artifacts.length}.`);
  }

  process.stdout.write(`Validated ${artifacts.length} package tarballs.\n`);
}

await main();
