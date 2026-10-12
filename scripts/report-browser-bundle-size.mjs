// Copyright © 2026 Mcont.

import { execFile } from "node:child_process";
import { gzipSync } from "node:zlib";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { builtinModules } from "node:module";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

/** Promise-based process runner for the Vite bundle build. */
const execFileAsync = promisify(execFile);

/** Workspace root resolved independently from the caller's current directory. */
const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Vite configuration that emits the three minified bundles and module lists. */
const bundleConfigPath = path.join(workspaceRoot, "scripts", "browser-client-bundle.config.mjs");

/** Directory that receives the bundles and module lists. */
const bundleRoot = path.join(workspaceRoot, ".artifacts", "browser-bundle-size");

/**
 * Frozen ceilings for the three recorded bundles.
 *
 * The first measurement was browser 153755/33009, core 78513/16794, and
 * integration 80785/17096 minified/gzip bytes. Each ceiling sits about ten
 * percent above the minified size and about fifteen percent above gzip so a
 * toolchain difference can pass and a new dependency cannot.
 */
const baselinePath = path.join(workspaceRoot, "spec", "browser-bundle-baseline.json");

/** Generated release report. The directory is not committed. */
const reportPath = path.join(workspaceRoot, ".artifacts", "reports", "browser-bundle-size.json");

/** Node.js built-ins in both bare and explicit `node:` forms. */
const nodeBuiltinSpecifiers = new Set(
  builtinModules.flatMap((moduleName) => [moduleName, `node:${moduleName}`]),
);

/**
 * Workspace packages that may appear in the public browser bundle.
 *
 * `transport-fetch-node` is absent. A browser bundle that reaches it has
 * crossed the Node boundary.
 */
const browserPackages = new Set([
  "auth-basic",
  "client",
  "codec-json",
  "core-domain",
  "core-runtime",
  "core-spi",
  "integration-openai-compatible",
  "transport-fetch-browser",
  "transport-fetch-shared",
]);

/** Workspace packages that may appear in the core bundle. */
const corePackages = new Set(["core-domain", "core-runtime", "core-spi"]);

/** Workspace packages that may appear in the default integration bundle. */
const integrationPackages = new Set(["core-domain", "core-spi", "integration-openai-compatible"]);

/**
 * Classifies one bundled module id.
 *
 * Bundler helpers use a NUL prefix and carry no application dependency.
 * Anything outside the named workspace packages is an unrelated plugin or a
 * Node built-in.
 *
 * @param {string} moduleId Absolute or virtual module id.
 * @param {ReadonlySet<string>} allowedPackages Package directory names for this bundle.
 * @returns {"bundler" | "node" | "sdk" | "unrelated"} Module class.
 */
export function classifyBundleModule(moduleId, allowedPackages) {
  if (moduleId.startsWith("\0")) {
    return "bundler";
  }
  if (moduleId.startsWith("node:") || nodeBuiltinSpecifiers.has(moduleId)) {
    return "node";
  }
  const packageMatch = /\/packages\/([^/]+)\//.exec(moduleId);
  if (packageMatch?.[1] !== undefined && allowedPackages.has(packageMatch[1])) {
    return "sdk";
  }
  return "unrelated";
}

/**
 * Rejects a bundle that imports Node or a package outside its allow-list.
 *
 * @param {readonly string[]} moduleIds Module ids collected during the build.
 * @param {ReadonlySet<string>} allowedPackages Package directory names for this bundle.
 * @param {string} bundleName Bundle label used in the diagnostic.
 */
export function assertBundleIsolation(moduleIds, allowedPackages, bundleName) {
  const rejected = moduleIds.filter(
    (moduleId) =>
      classifyBundleModule(moduleId, allowedPackages) !== "sdk" &&
      classifyBundleModule(moduleId, allowedPackages) !== "bundler",
  );
  if (rejected.length > 0) {
    throw new Error(
      `${bundleName} bundle includes ${rejected.length} Node or unrelated module(s): ${rejected.join(", ")}`,
    );
  }
}

/**
 * Rejects a measurement that exceeds the frozen ceiling.
 *
 * The ceiling is the recorded baseline plus a small allowance. Growth past it
 * is a release failure until the baseline is reviewed again.
 *
 * @param {string} bundleName Bundle label used in the diagnostic.
 * @param {{ minifiedBytes: number, gzipBytes: number }} measured Measured sizes.
 * @param {{ maxMinifiedBytes: number, maxGzipBytes: number }} ceiling Frozen ceiling.
 */
export function assertWithinBaseline(bundleName, measured, ceiling) {
  if (
    measured.minifiedBytes > ceiling.maxMinifiedBytes ||
    measured.gzipBytes > ceiling.maxGzipBytes
  ) {
    throw new Error(
      `${bundleName} bundle is ${measured.minifiedBytes} minified bytes and ${measured.gzipBytes} gzip bytes, above ${ceiling.maxMinifiedBytes} and ${ceiling.maxGzipBytes}.`,
    );
  }
}

/**
 * Measures one bundle the Vite configuration already wrote.
 *
 * @param {string} bundleName Bundle label stored in the report.
 * @param {ReadonlySet<string>} allowedPackages Package directory names for this bundle.
 * @returns {Promise<{ name: string, minifiedBytes: number, gzipBytes: number, modules: number }>}
 */
async function measureBundle(bundleName, allowedPackages) {
  const bytes = await readFile(path.join(bundleRoot, bundleName, "index.js"));
  const moduleIds = JSON.parse(
    await readFile(path.join(bundleRoot, `${bundleName}-modules.json`), "utf8"),
  );
  if (!Array.isArray(moduleIds) || moduleIds.some((moduleId) => typeof moduleId !== "string")) {
    throw new Error(`${bundleName} bundle did not record its module graph.`);
  }
  assertBundleIsolation(moduleIds, allowedPackages, bundleName);
  return {
    name: bundleName,
    minifiedBytes: bytes.byteLength,
    gzipBytes: gzipSync(bytes).byteLength,
    modules: moduleIds.length,
  };
}

/** Builds one library bundle with the workspace Vite binary. */
async function buildBundle(bundleName) {
  const viteExecutable =
    process.platform === "win32"
      ? path.join(workspaceRoot, "node_modules", ".bin", "vite.cmd")
      : path.join(workspaceRoot, "node_modules", ".bin", "vite");
  await execFileAsync(viteExecutable, ["build", "--config", bundleConfigPath], {
    cwd: workspaceRoot,
    env: { ...process.env, MCONET_BUNDLE: bundleName },
  });
}

/**
 * Reads the frozen ceilings.
 *
 * @returns {Promise<Record<string, { maxMinifiedBytes: number, maxGzipBytes: number }>>}
 */
async function readBaseline() {
  const parsed = JSON.parse(await readFile(baselinePath, "utf8"));
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("The browser bundle baseline is not an object.");
  }
  return parsed;
}

/** Builds the three bundles, checks isolation and ceilings, and writes the report. */
async function reportBrowserBundleSize() {
  const baseline = await readBaseline();
  const bundles = [];
  for (const [bundleName, allowedPackages] of [
    ["browser", browserPackages],
    ["core", corePackages],
    ["integration", integrationPackages],
  ]) {
    await buildBundle(bundleName);
    bundles.push(await measureBundle(bundleName, allowedPackages));
  }
  for (const bundle of bundles) {
    const ceiling = baseline[bundle.name];
    if (
      ceiling === undefined ||
      !Number.isInteger(ceiling.maxMinifiedBytes) ||
      !Number.isInteger(ceiling.maxGzipBytes)
    ) {
      throw new Error(`The browser bundle baseline has no ceiling for ${bundle.name}.`);
    }
    assertWithinBaseline(bundle.name, bundle, ceiling);
  }
  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(
    reportPath,
    `${JSON.stringify({ suite: "browser-bundle-size", bundles }, null, 2)}\n`,
  );
  const summary = bundles
    .map((bundle) => `${bundle.name} ${bundle.minifiedBytes}/${bundle.gzipBytes}`)
    .join(", ");
  process.stdout.write(`Browser bundle size report: ${summary}.\n`);
}

/** Proves isolation and ceiling checks without building. */
function selfTestBrowserBundleSize() {
  const allowed = new Set(["client"]);
  if (classifyBundleModule("/repo/packages/client/src/browser.ts", allowed) !== "sdk") {
    throw new Error("Bundle size self-test failed to accept a workspace module.");
  }
  if (classifyBundleModule("\0vite/preload-helper", allowed) !== "bundler") {
    throw new Error("Bundle size self-test failed to accept a bundler helper.");
  }
  if (classifyBundleModule("node:fs", allowed) !== "node") {
    throw new Error("Bundle size self-test failed to reject a Node built-in.");
  }
  if (classifyBundleModule("/repo/node_modules/ws/index.js", allowed) !== "unrelated") {
    throw new Error("Bundle size self-test failed to reject an unrelated package.");
  }
  if (
    classifyBundleModule("/repo/packages/transport-fetch-node/src/index.ts", allowed) !==
    "unrelated"
  ) {
    throw new Error("Bundle size self-test failed to reject the Node transport.");
  }

  let rejectedNodeModule = false;
  try {
    assertBundleIsolation(["/repo/packages/client/src/browser.ts", "node:fs"], allowed, "browser");
  } catch (error) {
    rejectedNodeModule =
      error instanceof Error && error.message.includes("Node or unrelated module");
  }
  if (!rejectedNodeModule) {
    throw new Error("Bundle size self-test failed to reject a mixed module graph.");
  }

  assertWithinBaseline(
    "browser",
    { minifiedBytes: 10, gzipBytes: 8 },
    { maxMinifiedBytes: 10, maxGzipBytes: 8 },
  );
  let rejectedGrowth = false;
  try {
    assertWithinBaseline(
      "browser",
      { minifiedBytes: 11, gzipBytes: 8 },
      { maxMinifiedBytes: 10, maxGzipBytes: 8 },
    );
  } catch (error) {
    rejectedGrowth = error instanceof Error && error.message.includes("above 10 and 8");
  }
  if (!rejectedGrowth) {
    throw new Error("Bundle size self-test failed to reject growth past the ceiling.");
  }
  process.stdout.write("Browser bundle size self-test passed.\n");
}

/** Parses command arguments and runs either the size report or its self-test. */
async function main() {
  const [argument, ...unexpectedArguments] = process.argv.slice(2);
  if (unexpectedArguments.length > 0 || (argument && argument !== "--self-test")) {
    throw new Error("Usage: node scripts/report-browser-bundle-size.mjs [--self-test]");
  }
  if (argument === "--self-test") {
    selfTestBrowserBundleSize();
    return;
  }
  await reportBrowserBundleSize();
}

try {
  await main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}
