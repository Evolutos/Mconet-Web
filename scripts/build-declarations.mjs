// Copyright © 2026 Mcont.

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import ts from "typescript";

/** Workspace root resolved independently from the caller's current directory. */
const workspaceRoot = path.resolve(import.meta.dirname, "..");

/** Directory containing all package source and output directories. */
const packagesRoot = path.join(workspaceRoot, "packages");

/** Shared configuration that owns declaration emit settings. */
const declarationConfigPath = path.join(workspaceRoot, "tsconfig.declarations.json");

/**
 * Explicit type environments for Web contracts, the JSON codec, Node test
 * utilities, and transports.
 *
 * The JSON codec, basic authorization descriptions, the OpenAI-compatible
 * integration, the public client, and the shared Fetch mapper implement or
 * reference SPI contracts whose cancellation signal is AbortSignal, so they
 * use the same Web platform library as Core SPI.
 */
const environmentConfigByPackage = new Map([
  ["auth-basic", "tsconfig.web-platform.json"],
  ["client", "tsconfig.web-platform.json"],
  ["codec-json", "tsconfig.web-platform.json"],
  ["core-runtime", "tsconfig.web-platform.json"],
  ["core-spi", "tsconfig.web-platform.json"],
  ["integration-openai-compatible", "tsconfig.web-platform.json"],
  ["testing", "tsconfig.node.json"],
  ["transport-fetch-shared", "tsconfig.web-platform.json"],
  ["transport-fetch-browser", "tsconfig.browser.json"],
  ["transport-fetch-node", "tsconfig.node.json"],
]);

/** Default type environment for platform-neutral package declarations. */
const defaultEnvironmentConfig = "tsconfig.pure-core.json";

/**
 * Package order that guarantees declarations exist before dependent packages
 * resolve their public type imports.
 *
 * Every newly introduced package must be placed after all of its internal
 * dependencies. The explicit list also makes an unreviewed package addition a
 * deterministic build failure instead of silently compiling in filesystem order.
 */
const declarationBuildOrder = [
  "core-domain",
  "core-spi",
  "core-runtime",
  "auth-basic",
  "codec-json",
  "integration-openai-compatible",
  "testing",
  "transport-fetch-shared",
  "transport-fetch-browser",
  "transport-fetch-node",
  "client",
];

/** TypeScript diagnostic host that emits workspace-relative context. */
const diagnosticHost = {
  getCanonicalFileName: (fileName) => fileName,
  getCurrentDirectory: () => workspaceRoot,
  getNewLine: () => ts.sys.newLine,
};

/**
 * Parses a tsconfig and rejects configuration diagnostics.
 *
 * @param {string} configPath Absolute tsconfig path.
 * @returns {ts.ParsedCommandLine} Parsed files and compiler options.
 */
function parseConfig(configPath) {
  // Preserve native TypeScript read diagnostics before resolving inherited
  // configuration, file discovery, and compiler options.
  const loaded = ts.readConfigFile(configPath, ts.sys.readFile);
  if (loaded.error) {
    throw new Error(ts.formatDiagnosticsWithColorAndContext([loaded.error], diagnosticHost));
  }

  // Parse relative to the owning config and reject semantic configuration errors
  // before any package output is touched.
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
 * Returns the package role owning a declaration source file.
 *
 * @param {string} filePath Absolute TypeScript source path.
 * @returns {string} Owning package role.
 */
function packageRoleForFile(filePath) {
  // Derive the first workspace-relative path segment and fail closed if the
  // declaration source is outside the fixed packages root.
  const relativePath = path.relative(packagesRoot, filePath);
  const [packageRole] = relativePath.split(path.sep);

  if (!packageRole || relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error(`Declaration source is outside the packages directory: ${filePath}`);
  }

  return packageRole;
}

/**
 * Throws a package-scoped error when TypeScript reports diagnostics.
 *
 * @param {readonly ts.Diagnostic[]} diagnostics TypeScript diagnostics.
 * @param {string} packageRole Package currently being emitted.
 */
function assertNoDiagnostics(diagnostics, packageRole) {
  // Avoid formatting work on the successful path.
  if (diagnostics.length === 0) {
    return;
  }

  // Combine all compiler diagnostics into one package-scoped failure.
  const formatted = ts.formatDiagnosticsWithColorAndContext(diagnostics, diagnosticHost);
  throw new Error(`Declaration build failed for '${packageRole}'.\n${formatted}`);
}

/**
 * Removes declaration artifacts recursively while preserving JavaScript output.
 *
 * @param {string} directory Package output directory.
 */
async function removeDeclarationOutputs(directory) {
  // Read the current output tree without assuming that a package has already
  // produced a dist directory.
  /** @type {import("node:fs").Dirent[]} */
  let entries;

  try {
    entries = await fs.readdir(directory, { withFileTypes: true });
  } catch (error) {
    // A missing directory is already clean; every other filesystem failure must
    // remain fatal so stale declarations cannot be silently retained.
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return;
    }
    throw error;
  }

  // Recurse through nested output folders concurrently, removing only declaration
  // files and maps while preserving previously emitted JavaScript artifacts.
  await Promise.all(
    entries.map(async (entry) => {
      // Descend into directories, ignore unrelated JavaScript artifacts, and
      // remove only declaration files at leaf entries.
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await removeDeclarationOutputs(entryPath);
        return;
      }

      if (entry.name.endsWith(".d.ts") || entry.name.endsWith(".d.ts.map")) {
        await fs.rm(entryPath);
      }
    }),
  );
}

/**
 * Type-checks and emits declarations for one package into its existing `dist`.
 *
 * @param {string} packageRole Workspace package role.
 * @param {readonly string[]} sourceFiles Absolute package source paths.
 * @param {ts.CompilerOptions} declarationOptions Shared declaration options.
 */
async function buildPackageDeclarations(packageRole, sourceFiles, declarationOptions) {
  // Resolve package roots and its explicit runtime type environment before
  // merging shared declaration-only compiler options.
  const packageRoot = path.join(packagesRoot, packageRole);
  const sourceRoot = path.join(packageRoot, "src");
  const outputRoot = path.join(packageRoot, "dist");
  const environmentConfigName =
    environmentConfigByPackage.get(packageRole) ?? defaultEnvironmentConfig;
  const environmentConfig = parseConfig(path.join(workspaceRoot, environmentConfigName));
  const compilerOptions = {
    ...environmentConfig.options,
    ...declarationOptions,
    outDir: outputRoot,
    rootDir: sourceRoot,
  };

  // Remove stale declaration artifacts first, leaving JavaScript from the ESM
  // build intact for the combined package output.
  await removeDeclarationOutputs(outputRoot);

  // Type-check the isolated package program before emitting declarations.
  const program = ts.createProgram({ options: compilerOptions, rootNames: [...sourceFiles] });
  assertNoDiagnostics(ts.getPreEmitDiagnostics(program), packageRole);

  // Emit and reject diagnostics or an unexpected skipped output, preventing a
  // partially updated declaration surface.
  const emitResult = program.emit();
  assertNoDiagnostics(emitResult.diagnostics, packageRole);
  if (emitResult.emitSkipped) {
    throw new Error(`Declaration emit was unexpectedly skipped for '${packageRole}'.`);
  }
}

/**
 * Emits declaration files for every package in the shared declaration config.
 */
async function main() {
  // Parse shared declaration configuration and group every resolved source by
  // package to avoid cross-package compiler programs.
  const declarationConfig = parseConfig(declarationConfigPath);
  /** @type {Map<string, string[]>} */
  const sourcesByPackage = new Map();

  for (const sourceFile of declarationConfig.fileNames) {
    const packageRole = packageRoleForFile(sourceFile);
    const packageSources = sourcesByPackage.get(packageRole) ?? [];
    packageSources.push(sourceFile);
    sourcesByPackage.set(packageRole, packageSources);
  }

  // Reject source-bearing packages missing from the reviewed dependency order.
  // Otherwise a new internal dependency could compile only when stale output is
  // present, making clean and incremental builds disagree.
  const unorderedPackages = [...sourcesByPackage.keys()].filter(
    (packageRole) => !declarationBuildOrder.includes(packageRole),
  );
  if (unorderedPackages.length > 0) {
    throw new Error(
      `Declaration build order is missing package entries: ${unorderedPackages.sort().join(", ")}`,
    );
  }

  // Emit one package at a time in dependency order. TypeScript then resolves an
  // internal package's public declarations from the output produced earlier in
  // this same clean build rather than relying on stale local artifacts.
  let builtPackageCount = 0;
  for (const packageRole of declarationBuildOrder) {
    const sourceFiles = sourcesByPackage.get(packageRole);
    if (!sourceFiles) {
      // An ordered package with no source entry requires no output in this build.
      continue;
    }

    await buildPackageDeclarations(packageRole, sourceFiles.sort(), declarationConfig.options);
    builtPackageCount += 1;
  }

  // Summarize only after every isolated package emit succeeds.
  process.stdout.write(`Built declarations for ${builtPackageCount} package entries.\n`);
}

await main();
