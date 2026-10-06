// Copyright © 2026 Mcont.

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import ts from "typescript";

/** Workspace root resolved independently from the caller's current directory. */
const workspaceRoot = path.resolve(import.meta.dirname, "..");

/** Directory containing all package source and output directories. */
const packagesRoot = path.join(workspaceRoot, "packages");

/** Shared build configuration that owns JavaScript emit settings. */
const buildConfigPath = path.join(workspaceRoot, "tsconfig.build.json");

/**
 * Runtime type configurations used while type-checking each emitted package.
 *
 * Platform-neutral packages use the pure-core environment by default. Browser
 * and Node transports receive only their explicitly reviewed runtime APIs.
 */
const environmentConfigByPackage = new Map([
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
  const loaded = ts.readConfigFile(configPath, ts.sys.readFile);
  if (loaded.error) {
    throw new Error(ts.formatDiagnosticsWithColorAndContext([loaded.error], diagnosticHost));
  }

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
  if (diagnostics.length === 0) {
    return;
  }

  const formatted = ts.formatDiagnosticsWithColorAndContext(diagnostics, diagnosticHost);
  throw new Error(`ESM build failed for '${packageRole}'.\n${formatted}`);
}

/**
 * Type-checks and emits one package into its package-local `dist` directory.
 *
 * @param {string} packageRole Workspace package role.
 * @param {readonly string[]} sourceFiles Absolute package source file paths.
 * @param {ts.CompilerOptions} buildOptions Shared JavaScript emit options.
 */
async function buildPackage(packageRole, sourceFiles, buildOptions) {
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

  // Remove only this reviewed package output so stale modules cannot survive.
  await fs.rm(outputRoot, { force: true, recursive: true });

  const program = ts.createProgram({ options: compilerOptions, rootNames: [...sourceFiles] });
  assertNoDiagnostics(ts.getPreEmitDiagnostics(program), packageRole);

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
  const buildConfig = parseConfig(buildConfigPath);
  /** @type {Map<string, string[]>} */
  const sourcesByPackage = new Map();

  for (const sourceFile of buildConfig.fileNames) {
    const packageRole = packageRoleForFile(sourceFile);
    const packageSources = sourcesByPackage.get(packageRole) ?? [];
    packageSources.push(sourceFile);
    sourcesByPackage.set(packageRole, packageSources);
  }

  const packageBuilds = [...sourcesByPackage.entries()]
    .sort(([leftRole], [rightRole]) => leftRole.localeCompare(rightRole))
    .map(([packageRole, sourceFiles]) =>
      buildPackage(packageRole, sourceFiles.sort(), buildConfig.options),
    );
  await Promise.all(packageBuilds);

  process.stdout.write(`Built ${packageBuilds.length} ESM package entries.\n`);
}

await main();
