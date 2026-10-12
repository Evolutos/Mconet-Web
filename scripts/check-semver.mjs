// Copyright © 2026 Mcont.

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

/** Workspace root resolved independently from the caller's current directory. */
const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Directory containing the lockstep SDK packages. */
const packagesRoot = path.join(workspaceRoot, "packages");

/**
 * Unpublished engineering release shared by every SDK package.
 *
 * The first public prerelease is `1.0.0-alpha.N`, `1.0.0-beta.N`, or
 * `1.0.0-rc.N`. A stable release starts at `1.0.0`. This check accepts only
 * the development release until a later release step changes that type.
 */
const DEVELOPMENT_VERSION = "0.0.0";

/** Name prefix that identifies a package on the SDK release train. */
const SDK_PACKAGE_PREFIX = "@evolutos/mconet-";

/** Numeric core of a Semantic Version, without a prerelease or build suffix. */
const STABLE_VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

/** Controlled prerelease identifiers that may precede the first stable release. */
const PRERELEASE_VERSION_PATTERN = /^1\.0\.0-(alpha|beta|rc)\.(0|[1-9]\d*)$/;

/**
 * @typedef {"development" | "prerelease" | "stable"} ReleaseType
 */

/**
 * @typedef {object} PackageMetadata
 * @property {string} name Package name from the manifest.
 * @property {string} version Package version from the manifest.
 * @property {boolean} isPrivate Whether the package is marked private.
 */

/**
 * Narrows parsed JSON to a non-null record.
 *
 * @param {unknown} value Parsed manifest value.
 * @returns {value is Record<string, unknown>} Whether the value is a record.
 */
function isRecord(value) {
  // JSON objects exclude null and arrays even though both are objects.
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Classifies one version against the release-train rules.
 *
 * An unrecognized string is rejected instead of being treated as a patch.
 *
 * @param {string} version Candidate version.
 * @returns {ReleaseType} Release type implied by the version alone.
 */
function classifyVersion(version) {
  if (version === DEVELOPMENT_VERSION) {
    return "development";
  }

  if (PRERELEASE_VERSION_PATTERN.test(version)) {
    return "prerelease";
  }

  // Only 1.0.0 and later unqualified versions are stable. 0.x.y other than
  // the engineering placeholder is not a release type on this train.
  if (STABLE_VERSION_PATTERN.test(version)) {
    const [major] = version.split(".");
    if (major !== "0") {
      return "stable";
    }
  }

  throw new Error(`Version '${version}' is not a development, prerelease, or stable release.`);
}

/**
 * Checks one manifest record against the current development release.
 *
 * @param {PackageMetadata} metadata Package identity and version fields.
 * @param {{ requireSdkName: boolean }} options Whether the SDK name prefix is required.
 */
function checkDevelopmentPackage(metadata, options) {
  // A non-development version cannot pass by also flipping the private flag.
  const releaseType = classifyVersion(metadata.version);
  if (releaseType !== "development") {
    throw new Error(
      `Package '${metadata.name}' is ${metadata.version}, which is a ${releaseType} version.`,
    );
  }

  // The engineering release stays private so it cannot be installed as a public package.
  if (!metadata.isPrivate) {
    throw new Error(`Package '${metadata.name}' must stay private at ${DEVELOPMENT_VERSION}.`);
  }

  if (options.requireSdkName && !metadata.name.startsWith(SDK_PACKAGE_PREFIX)) {
    throw new Error(
      `Package '${metadata.name}' is outside the ${SDK_PACKAGE_PREFIX} release train.`,
    );
  }
}

/**
 * Checks that every supplied package belongs to the same development release.
 *
 * @param {readonly PackageMetadata[]} packages SDK packages and the workspace root.
 * @param {{ requireSdkName: boolean }} options Whether every name must use the SDK prefix.
 */
function checkDevelopmentRelease(packages, options) {
  // An empty inventory would otherwise pass without proving lockstep versions.
  if (packages.length === 0) {
    throw new Error("The release train does not contain a package.");
  }

  const versions = new Set(packages.map((metadata) => metadata.version));
  if (versions.size !== 1) {
    throw new Error(
      `Release-train packages do not share one version: ${[...versions].sort().join(", ")}.`,
    );
  }

  for (const metadata of packages) {
    checkDevelopmentPackage(metadata, options);
  }
}

/**
 * Reads the name, version, and private flag from one manifest.
 *
 * @param {string} manifestPath Manifest path used in diagnostics.
 * @param {string} source Manifest JSON.
 * @returns {PackageMetadata} Validated package metadata.
 */
function readPackageMetadata(manifestPath, source) {
  /** @type {unknown} */
  let parsed;
  try {
    parsed = JSON.parse(source);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid JSON in ${manifestPath}: ${message}`, { cause: error });
  }

  if (!isRecord(parsed) || typeof parsed.name !== "string" || typeof parsed.version !== "string") {
    throw new Error(`Package manifest ${manifestPath} has no name and version.`);
  }

  if (parsed.private !== true) {
    // Preserve a false or missing flag as not private; the release check reports it.
    return { name: parsed.name, version: parsed.version, isPrivate: false };
  }

  return { name: parsed.name, version: parsed.version, isPrivate: true };
}

/**
 * Reads the workspace root and every SDK package manifest.
 *
 * @returns {Promise<readonly PackageMetadata[]>} Manifests on the release train.
 */
async function readReleaseTrain() {
  const rootSource = await readFile(path.join(workspaceRoot, "package.json"), "utf8");
  const root = readPackageMetadata(path.join(workspaceRoot, "package.json"), rootSource);
  const packageNames = (await readdir(packagesRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  if (packageNames.length === 0) {
    throw new Error("The packages directory does not contain an SDK package.");
  }

  /** @type {PackageMetadata[]} */
  const packages = [root];
  for (const packageName of packageNames) {
    const manifestPath = path.join(packagesRoot, packageName, "package.json");
    packages.push(readPackageMetadata(manifestPath, await readFile(manifestPath, "utf8")));
  }
  return packages;
}

/**
 * Proves acceptance of the development release and rejection of the other types.
 */
function selfTest() {
  const developmentPackages = [
    { name: "mconet-web", version: DEVELOPMENT_VERSION, isPrivate: true },
    { name: "@evolutos/mconet-client", version: DEVELOPMENT_VERSION, isPrivate: true },
  ];
  checkDevelopmentRelease(developmentPackages, { requireSdkName: false });
  checkDevelopmentPackage(developmentPackages[1], { requireSdkName: true });

  const rejectedCases = [
    {
      label: "mixed versions",
      run() {
        checkDevelopmentRelease(
          [
            { name: "@evolutos/mconet-client", version: DEVELOPMENT_VERSION, isPrivate: true },
            { name: "@evolutos/mconet-core-domain", version: "0.0.1", isPrivate: true },
          ],
          { requireSdkName: true },
        );
      },
    },
    {
      label: "public development package",
      run() {
        checkDevelopmentPackage(
          { name: "@evolutos/mconet-client", version: DEVELOPMENT_VERSION, isPrivate: false },
          { requireSdkName: true },
        );
      },
    },
    {
      label: "prerelease during development",
      run() {
        checkDevelopmentPackage(
          { name: "@evolutos/mconet-client", version: "1.0.0-rc.1", isPrivate: true },
          { requireSdkName: true },
        );
      },
    },
    {
      label: "stable version during development",
      run() {
        checkDevelopmentPackage(
          { name: "@evolutos/mconet-client", version: "1.0.0", isPrivate: false },
          { requireSdkName: true },
        );
      },
    },
    {
      label: "invalid version",
      run() {
        classifyVersion("v1.0.0");
      },
    },
    {
      label: "package outside the release train",
      run() {
        checkDevelopmentPackage(
          { name: "example-app", version: DEVELOPMENT_VERSION, isPrivate: true },
          { requireSdkName: true },
        );
      },
    },
  ];

  for (const rejectedCase of rejectedCases) {
    let rejected = false;
    try {
      rejectedCase.run();
    } catch (error) {
      rejected = error instanceof Error && error.message.length > 0;
    }
    if (!rejected) {
      throw new Error(`Semver self-test did not reject ${rejectedCase.label}.`);
    }
  }

  if (classifyVersion("1.0.0-beta.2") !== "prerelease" || classifyVersion("1.2.3") !== "stable") {
    throw new Error("Semver self-test misclassified a non-development version.");
  }
}

const argument = process.argv[2];

if (process.argv.length > 3 || (argument !== undefined && argument !== "--self-test")) {
  throw new Error("Usage: node scripts/check-semver.mjs [--self-test]");
}

if (argument === "--self-test") {
  selfTest();
} else {
  const packages = await readReleaseTrain();
  const sdkPackages = packages.filter((metadata) => metadata.name.startsWith(SDK_PACKAGE_PREFIX));
  checkDevelopmentRelease(packages, { requireSdkName: false });
  checkDevelopmentRelease(sdkPackages, { requireSdkName: true });
}
