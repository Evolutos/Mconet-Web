// Copyright © 2026 Mcont.

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import ts from "typescript";

/** Supported command-line switch for diagnostics without JavaScript emit. */
const typecheckArgument = "--check";

/** User-provided command-line arguments, excluding Node.js and script paths. */
const commandArguments = process.argv.slice(2);

if (
  commandArguments.length > 1 ||
  (commandArguments.length === 1 && commandArguments[0] !== typecheckArgument)
) {
  throw new Error(`Usage: node scripts/build-esm.mjs [${typecheckArgument}]`);
}

/** Whether this invocation must validate types without changing build output. */
const typecheckOnly = commandArguments[0] === typecheckArgument;

/** Workspace root resolved independently from the caller's current directory. */
const workspaceRoot = path.resolve(import.meta.dirname, "..");

/** Directory containing all package source and output directories. */
const packagesRoot = path.join(workspaceRoot, "packages");

/** Shared build configuration that owns JavaScript emit settings. */
const buildConfigPath = path.join(workspaceRoot, "tsconfig.build.json");

/**
 * Runtime type configurations used while type-checking each emitted package.
 *
 * Platform-neutral packages use the pure-core environment by default. Shared
 * Web SPI contracts, Node test utilities, and platform transports receive only
 * their explicitly reviewed runtime APIs.
 */
const environmentConfigByPackage = new Map([
  ["core-runtime", "tsconfig.web-platform.json"],
  ["core-spi", "tsconfig.web-platform.json"],
  ["testing", "tsconfig.node.json"],
  ["transport-fetch-browser", "tsconfig.browser.json"],
  ["transport-fetch-node", "tsconfig.node.json"],
]);

/** Default runtime type environment for platform-neutral packages. */
const defaultEnvironmentConfig = "tsconfig.pure-core.json";

/**
 * TypeScript diagnostic host that keeps compiler messages workspace-relative.
 */
const diagnosticHost = {
  getCanonicalFileName: (fileName) => fileName,
  getCurrentDirectory: () => workspaceRoot,
  getNewLine: () => ts.sys.newLine,
};

/**
 * Parses a tsconfig and fails immediately on configuration diagnostics.
 *
 * @param {string} configPath Absolute tsconfig path.
 * @returns {ts.ParsedCommandLine} Parsed file list and compiler options.
 */
function parseConfig(configPath) {
  // Read raw JSON first so syntax and file-access diagnostics retain TypeScript's
  // native context rather than being converted to generic parse failures.
  const loaded = ts.readConfigFile(configPath, ts.sys.readFile);
  if (loaded.error) {
    throw new Error(ts.formatDiagnosticsWithColorAndContext([loaded.error], diagnosticHost));
  }

  // Resolve extends/include/options relative to the config file and reject every
  // semantic configuration diagnostic before compilation begins.
  const parsed = ts.parseJsonConfigFileContent(
    loaded.config,
    ts.sys,
    path.dirname(configPath),
    undefined,
    configPath,
  );
  if (parsed.errors.length > 0) {
    throw new Error(ts.formatDiagnosticsWithColorAndContext(parsed.errors, diagnosticHost));
  }

  return parsed;
}

/**
 * Returns the package role owning a source file included by the build config.
 *
 * @param {string} filePath Absolute TypeScript source path.
 * @returns {string} Owning package role.
 */
function packageRoleForFile(filePath) {
  // Derive package ownership from the fixed packages root and reject any source
  // that escapes the expected workspace layout.
  const relativePath = path.relative(packagesRoot, filePath);
  const [packageRole] = relativePath.split(path.sep);

  if (!packageRole || relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error(`Build source is outside the packages directory: ${filePath}`);
  }

  return packageRole;
}

/**
 * Formats compiler diagnostics and throws one deterministic build error.
 *
 * @param {readonly ts.Diagnostic[]} diagnostics TypeScript diagnostics.
 * @param {string} packageRole Package currently being built.
 */
function assertNoDiagnostics(diagnostics, packageRole) {
  // The successful hot path returns without formatting or allocating error text.
  if (diagnostics.length === 0) {
    return;
  }

  // Format the complete diagnostic set and name the active operation so the same
  // helper produces precise typecheck and emit failures.
  const formatted = ts.formatDiagnosticsWithColorAndContext(diagnostics, diagnosticHost);
  const operationName = typecheckOnly ? "Typecheck" : "ESM build";
  throw new Error(`${operationName} failed for '${packageRole}'.\n${formatted}`);
}

/**
 * Removes JavaScript artifacts recursively while preserving declarations.
 *
 * Declaration output is prepared before ESM compilation so dependent packages
 * can resolve public workspace types. Removing only JavaScript files keeps that
 * dependency surface and the final package declarations intact.
 *
 * @param {string} directory Package output directory.
 */
async function removeJavaScriptOutputs(directory) {
  // Read the current tree without requiring an earlier declaration or ESM build.
  /** @type {import("node:fs").Dirent[]} */
  let entries;

  try {
    entries = await fs.readdir(directory, { withFileTypes: true });
  } catch (error) {
    // A missing output directory is already free of stale JavaScript. Preserve
    // every other filesystem failure so incomplete cleanup cannot be ignored.
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return;
    }
    throw error;
  }

  // Traverse nested output deterministically and remove only files owned by the
  // ESM build. Declaration files and maps remain available to later packages.
  await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await removeJavaScriptOutputs(entryPath);
        return;
      }

      if (entry.name.endsWith(".js") || entry.name.endsWith(".js.map")) {
        await fs.rm(entryPath);
      }
    }),
  );
}

/**
 * Type-checks one package and optionally emits its package-local ESM output.
 *
 * @param {string} packageRole Workspace package role.
 * @param {readonly string[]} sourceFiles Absolute package source file paths.
 * @param {ts.CompilerOptions} buildOptions Shared JavaScript emit options.
 * @param {boolean} shouldEmit Whether validated source should be emitted.
 */
async function buildPackage(packageRole, sourceFiles, buildOptions, shouldEmit) {
  // Resolve package-local roots and the reviewed runtime type environment before
  // merging it with shared emit options.
  const packageRoot = path.join(packagesRoot, packageRole);
  const sourceRoot = path.join(packageRoot, "src");
  const outputRoot = path.join(packageRoot, "dist");
  const environmentConfigName =
    environmentConfigByPackage.get(packageRole) ?? defaultEnvironmentConfig;
  const environmentConfig = parseConfig(path.join(workspaceRoot, environmentConfigName));
  const compilerOptions = {
    ...environmentConfig.options,
    ...buildOptions,
    outDir: outputRoot,
    rootDir: sourceRoot,
  };

  // Create one isolated program per package and stop on all pre-emit diagnostics,
  // preventing invalid code from reaching either mode's output stage.
  const program = ts.createProgram({ options: compilerOptions, rootNames: [...sourceFiles] });
  assertNoDiagnostics(ts.getPreEmitDiagnostics(program), packageRole);

  if (!shouldEmit) {
    // Typecheck mode is deliberately read-only after successful diagnostics.
    return;
  }

  // Remove stale ESM artifacts without deleting declarations prepared for
  // workspace dependency resolution and final package publication.
  await removeJavaScriptOutputs(outputRoot);

  // Emit into the clean package-local directory and reject both reported
  // diagnostics and an unexpected compiler decision to skip output.
  const emitResult = program.emit();
  assertNoDiagnostics(emitResult.diagnostics, packageRole);
  if (emitResult.emitSkipped) {
    throw new Error(`ESM emit was unexpectedly skipped for '${packageRole}'.`);
  }
}

/**
 * Builds every package declared by the shared build configuration.
 */
async function main() {
  // Parse the shared config once, then group its resolved source files by their
  // owning package so each compiler program retains a strict package boundary.
  const buildConfig = parseConfig(buildConfigPath);
  /** @type {Map<string, string[]>} */
  const sourcesByPackage = new Map();

  for (const sourceFile of buildConfig.fileNames) {
    const packageRole = packageRoleForFile(sourceFile);
    const packageSources = sourcesByPackage.get(packageRole) ?? [];
    packageSources.push(sourceFile);
    sourcesByPackage.set(packageRole, packageSources);
  }

  // Sort packages and their source lists for deterministic diagnostics, then run
  // independent package builds concurrently.
  const packageBuilds = [...sourcesByPackage.entries()]
    .sort(([leftRole], [rightRole]) => leftRole.localeCompare(rightRole))
    .map(([packageRole, sourceFiles]) =>
      buildPackage(packageRole, sourceFiles.sort(), buildConfig.options, !typecheckOnly),
    );
  await Promise.all(packageBuilds);

  // Report the selected mode and the number of completed package entries.
  const completedAction = typecheckOnly ? "Type-checked" : "Built";
  process.stdout.write(`${completedAction} ${packageBuilds.length} ESM package entries.\n`);
}

await main();
