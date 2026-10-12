// Copyright © 2026 Mcont.

import { execFile } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

/** Promise-based process runner for the temporary consumer. */
const execFileAsync = promisify(execFile);

/** Workspace root resolved independently from the caller's current directory. */
const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Directory containing the SDK packages whose exports are under test. */
const packagesRoot = path.join(workspaceRoot, "packages");

/** Conditions Node.js enables for an ESM import before any custom condition. */
const NODE_IMPORT_CONDITIONS = ["node", "import"];

/**
 * Conditions used to ask Node.js for the browser entry.
 *
 * Node.js keeps its own `node` condition enabled, so this list proves the
 * browser key wins only when the package places it before `node`.
 */
const BROWSER_ON_NODE_CONDITIONS = ["browser", "node", "import"];

/**
 * Conditions a browser bundler uses. The `node` condition is intentionally
 * absent so a Node entry cannot satisfy a browser consumer.
 */
const BROWSER_ONLY_CONDITIONS = ["browser", "import"];

/** Conditions used to select the TypeScript declaration before the runtime file. */
const TYPE_CONDITIONS = ["types", "node", "import"];

/** Import that must stay private because it is absent from package exports. */
const PRIVATE_IMPORT_SUFFIX = "/src/index.js";

/** Node.js code expected when a consumer imports a path the package did not export. */
const UNEXPORTED_PATH_CODE = "ERR_PACKAGE_PATH_NOT_EXPORTED";

/**
 * @typedef {object} ExportResolution
 * @property {string} packageName Public package name.
 * @property {string} subpath Export subpath, including `.`.
 * @property {string} specifier Module specifier a consumer imports.
 * @property {readonly string[]} conditions Active condition names, excluding `default`.
 * @property {string} target Package-relative export target.
 */

/**
 * Narrows parsed JSON to a non-null record.
 *
 * @param {unknown} value Parsed manifest value.
 * @returns {value is Record<string, unknown>} Whether the value is a record.
 */
function isRecord(value) {
  // JSON records exclude null and arrays even though both are objects.
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Resolves one conditional export target using object key order.
 *
 * The first matching condition wins. `default` matches even when it is absent
 * from the active condition list, which is how Node.js resolves exports.
 * Array fallback targets are rejected so an unreviewed form cannot pass.
 *
 * @param {unknown} target Current exports value.
 * @param {readonly string[]} conditions Active export conditions.
 * @returns {string} Package-relative target path.
 */
function resolveConditionalExport(target, conditions) {
  if (typeof target === "string") {
    return target;
  }

  if (Array.isArray(target) || !isRecord(target)) {
    throw new Error("An export target must be a string or a condition map.");
  }

  for (const [condition, value] of Object.entries(target)) {
    if (condition !== "default" && !conditions.includes(condition)) {
      continue;
    }

    return resolveConditionalExport(value, conditions);
  }

  throw new Error("The export did not match an active condition.");
}

/**
 * Builds the consumer specifier for one package export subpath.
 *
 * @param {string} packageName Public package name.
 * @param {string} subpath Export key from the manifest.
 * @returns {string} Specifier passed to a consumer import.
 */
function specifierFor(packageName, subpath) {
  if (subpath === ".") {
    return packageName;
  }

  if (!subpath.startsWith("./")) {
    throw new Error(`Package '${packageName}' has an unsupported export '${subpath}'.`);
  }

  return `${packageName}${subpath.slice(1)}`;
}

/**
 * Lists the resolutions a consumer must observe for one manifest.
 *
 * @param {string} packageName Public package name.
 * @param {unknown} exportsField Manifest exports field.
 * @param {readonly string[]} conditions Active conditions.
 * @returns {ExportResolution[]} Expected resolutions for those conditions.
 */
function expectedResolutions(packageName, exportsField, conditions) {
  if (!isRecord(exportsField)) {
    throw new Error(`Package '${packageName}' must declare conditional exports.`);
  }

  return Object.entries(exportsField).map(([subpath, target]) => ({
    packageName,
    subpath,
    specifier: specifierFor(packageName, subpath),
    conditions,
    target: resolveConditionalExport(target, conditions),
  }));
}

/**
 * Reads one package manifest and returns its name and exports.
 *
 * @param {string} packageDirectory Package directory name.
 * @returns {Promise<{ directory: string, name: string, exportsField: unknown }>} Manifest facts.
 */
async function readPackageManifest(packageDirectory) {
  const manifestPath = path.join(packagesRoot, packageDirectory, "package.json");
  /** @type {unknown} */
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  if (!isRecord(manifest) || typeof manifest.name !== "string" || !isRecord(manifest.exports)) {
    throw new Error(`Package manifest ${manifestPath} has no usable exports.`);
  }

  return { directory: packageDirectory, name: manifest.name, exportsField: manifest.exports };
}

/**
 * Creates a consumer outside the workspace and links each SDK package into it.
 *
 * The links are ordinary `node_modules` entries. Resolution therefore uses the
 * package exports map instead of a workspace protocol or a source import.
 *
 * @param {readonly { directory: string, name: string }[]} packages Packages to expose.
 * @returns {Promise<string>} Consumer directory. The caller deletes it.
 */
async function createIndependentConsumer(packages) {
  const consumerRoot = await mkdtemp(path.join(tmpdir(), "mconet-export-consumer-"));
  // A private ESM consumer keeps the resolution test out of the workspace package graph.
  await writeFile(
    path.join(consumerRoot, "package.json"),
    `${JSON.stringify({ name: "mconet-export-consumer", private: true, type: "module" }, null, 2)}\n`,
  );
  const scopeRoot = path.join(consumerRoot, "node_modules", "@evolutos");
  await mkdir(scopeRoot, { recursive: true });

  for (const sdkPackage of packages) {
    const [, packagePathName] = sdkPackage.name.split("/");
    if (packagePathName === undefined) {
      throw new Error(`Package '${sdkPackage.name}' is not scoped.`);
    }

    await symlink(
      path.join(packagesRoot, sdkPackage.directory),
      path.join(scopeRoot, packagePathName),
      "dir",
    );
  }

  return consumerRoot;
}

/**
 * Asks the temporary consumer to resolve every specifier with one condition set.
 *
 * @param {string} consumerRoot Independent consumer directory.
 * @param {readonly string[]} specifiers Specifiers to resolve.
 * @param {string | undefined} extraCondition Custom condition added with `--conditions`.
 * @returns {Promise<Map<string, string>>} Resolved file URLs by specifier.
 */
async function resolveFromConsumer(consumerRoot, specifiers, extraCondition) {
  const args = [];
  if (extraCondition !== undefined) {
    args.push(`--conditions=${extraCondition}`);
  }

  // Resolve without loading the module. A declaration file only has to be selected.
  args.push(
    "--input-type=module",
    "--eval",
    `
      const specifiers = JSON.parse(process.argv[1]);
      const results = [];
      for (const specifier of specifiers) {
        try {
          results.push({ specifier, href: import.meta.resolve(specifier) });
        } catch (error) {
          const code = error && typeof error === "object" && "code" in error ? error.code : "";
          results.push({ specifier, code: typeof code === "string" ? code : "" });
        }
      }
      process.stdout.write(JSON.stringify(results));
    `,
    JSON.stringify(specifiers),
  );

  const { stdout } = await execFileAsync(process.execPath, args, {
    cwd: consumerRoot,
    encoding: "utf8",
  });
  /** @type {unknown} */
  const parsed = JSON.parse(stdout);
  if (!Array.isArray(parsed)) {
    throw new Error("The export consumer returned a response that is not a list.");
  }

  /** @type {Map<string, string>} */
  const hrefs = new Map();
  for (const result of parsed) {
    if (!isRecord(result) || typeof result.specifier !== "string") {
      throw new Error("The export consumer returned an invalid resolution result.");
    }
    if (typeof result.href === "string") {
      hrefs.set(result.specifier, result.href);
      continue;
    }
    throw new Error(
      `Consumer failed to resolve '${result.specifier}' (${typeof result.code === "string" ? result.code : "unknown"}).`,
    );
  }

  return hrefs;
}

/**
 * Rejects a manifest target that leaves `dist` or escapes the package root.
 *
 * @param {string} packageDirectory Package directory under `packages`.
 * @param {ExportResolution} expected Expected specifier and target.
 * @returns {Promise<string>} Real path of the selected file.
 */
async function assertPackageTargetExists(packageDirectory, expected) {
  if (!expected.target.startsWith("./dist/")) {
    throw new Error(`Package '${expected.packageName}' exports '${expected.target}' outside dist.`);
  }

  const packageRoot = await realpath(path.join(packagesRoot, packageDirectory));
  const expectedPath = path.join(packageRoot, expected.target.slice(2));
  const resolvedPath = await realpath(expectedPath);
  const relativePath = path.relative(packageRoot, resolvedPath);
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error(
      `Package '${expected.packageName}' exports '${expected.target}' outside its root.`,
    );
  }

  return resolvedPath;
}

/**
 * Compares one Node resolution with the target selected from the manifest.
 *
 * @param {string} packageDirectory Package directory under `packages`.
 * @param {ExportResolution} expected Expected specifier and target.
 * @param {string} href File URL returned by the consumer.
 */
async function assertResolvedTarget(packageDirectory, expected, href) {
  const expectedPath = await assertPackageTargetExists(packageDirectory, expected);
  const resolvedPath = await realpath(fileURLToPath(href));
  if (resolvedPath !== expectedPath) {
    throw new Error(
      `Consumer resolved '${expected.specifier}' to '${resolvedPath}' instead of '${expectedPath}'.`,
    );
  }
}

/**
 * Resolves every public export from the independent consumer.
 *
 * @param {readonly { directory: string, name: string, exportsField: unknown }[]} packages Package manifests.
 * @param {string} consumerRoot Independent consumer directory.
 */
async function checkConsumerResolutions(packages, consumerRoot) {
  const groups = [
    { conditions: NODE_IMPORT_CONDITIONS, extraCondition: undefined },
    { conditions: BROWSER_ON_NODE_CONDITIONS, extraCondition: "browser" },
    { conditions: TYPE_CONDITIONS, extraCondition: "types" },
  ];

  for (const group of groups) {
    /** @type {ExportResolution[]} */
    const expected = packages.flatMap((sdkPackage) =>
      expectedResolutions(sdkPackage.name, sdkPackage.exportsField, group.conditions),
    );
    const hrefs = await resolveFromConsumer(
      consumerRoot,
      expected.map((resolution) => resolution.specifier),
      group.extraCondition,
    );

    for (const resolution of expected) {
      const href = hrefs.get(resolution.specifier);
      if (href === undefined) {
        throw new Error(`Consumer did not return '${resolution.specifier}'.`);
      }
      const sdkPackage = packages.find((candidate) => candidate.name === resolution.packageName);
      if (sdkPackage === undefined) {
        throw new Error(`Package '${resolution.packageName}' disappeared during export checking.`);
      }
      await assertResolvedTarget(sdkPackage.directory, resolution, href);
    }
  }
}

/**
 * Proves a consumer cannot import a source path that the exports map omits.
 *
 * @param {string} consumerRoot Independent consumer directory.
 * @param {string} packageName Package whose private path is requested.
 */
async function checkPrivatePathRejected(consumerRoot, packageName) {
  const specifier = `${packageName}${PRIVATE_IMPORT_SUFFIX}`;
  const { stdout } = await execFileAsync(
    process.execPath,
    [
      "--input-type=module",
      "--eval",
      `
        try {
          import.meta.resolve(process.argv[1]);
          process.stdout.write("resolved");
        } catch (error) {
          const code = error && typeof error === "object" && "code" in error ? error.code : "";
          process.stdout.write(typeof code === "string" ? code : "");
        }
      `,
      specifier,
    ],
    { cwd: consumerRoot, encoding: "utf8" },
  );

  if (stdout !== UNEXPORTED_PATH_CODE) {
    throw new Error(
      `Importing '${specifier}' produced '${stdout}' instead of a closed export map.`,
    );
  }
}

/**
 * Proves browser-only resolution ignores a later Node entry.
 */
function selfTest() {
  const clientExports = {
    ".": {
      types: "./dist/index.d.ts",
      browser: "./dist/browser.js",
      node: "./dist/node.js",
      default: "./dist/index.js",
    },
  };
  const nodeOnlyExports = {
    ".": {
      types: "./dist/index.d.ts",
      node: "./dist/index.js",
      default: "./dist/index.js",
    },
  };

  const browserConsumer = expectedResolutions(
    "@evolutos/mconet-client",
    clientExports,
    BROWSER_ONLY_CONDITIONS,
  );
  const nodeConsumer = expectedResolutions(
    "@evolutos/mconet-client",
    clientExports,
    NODE_IMPORT_CONDITIONS,
  );
  const browserOnNodePackage = expectedResolutions(
    "@evolutos/mconet-transport-fetch-node",
    nodeOnlyExports,
    BROWSER_ONLY_CONDITIONS,
  );

  if (
    browserConsumer[0]?.target !== "./dist/browser.js" ||
    nodeConsumer[0]?.target !== "./dist/node.js" ||
    browserOnNodePackage[0]?.target !== "./dist/index.js"
  ) {
    throw new Error("Export self-test selected the wrong conditional target.");
  }

  let rejectedArray = false;
  try {
    resolveConditionalExport(["./dist/index.js"], NODE_IMPORT_CONDITIONS);
  } catch (error) {
    rejectedArray = error instanceof Error;
  }
  if (!rejectedArray) {
    throw new Error("Export self-test accepted an array export target.");
  }
}

/**
 * Checks every SDK package from a consumer that is not part of the workspace.
 */
async function checkPackageExports() {
  const packageDirectories = (await readdir(packagesRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  const packages = [];
  for (const packageDirectory of packageDirectories) {
    packages.push(await readPackageManifest(packageDirectory));
  }

  const consumerRoot = await createIndependentConsumer(packages);
  try {
    await checkConsumerResolutions(packages, consumerRoot);
    const client = packages.find((sdkPackage) => sdkPackage.name === "@evolutos/mconet-client");
    if (client === undefined) {
      throw new Error("The client package is missing from the export check.");
    }
    await checkPrivatePathRejected(consumerRoot, client.name);

    // Browser bundlers do not enable the Node condition. The files selected by
    // that smaller condition set must exist even though this Node process
    // cannot turn its own condition off.
    for (const sdkPackage of packages) {
      const browserResolutions = expectedResolutions(
        sdkPackage.name,
        sdkPackage.exportsField,
        BROWSER_ONLY_CONDITIONS,
      );
      for (const resolution of browserResolutions) {
        await assertPackageTargetExists(sdkPackage.directory, resolution);
      }
    }
  } finally {
    await rm(consumerRoot, { recursive: true, force: true });
  }
}

const argument = process.argv[2];

if (process.argv.length > 3 || (argument !== undefined && argument !== "--self-test")) {
  throw new Error("Usage: node scripts/check-package-exports.mjs [--self-test]");
}

if (argument === "--self-test") {
  selfTest();
} else {
  await checkPackageExports();
}
