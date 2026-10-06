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

/** Runtime-specific type environments for the two platform transport packages. */
const environmentConfigByPackage = new Map([
  ["transport-fetch-browser", "tsconfig.browser.json"],
  ["transport-fetch-node", "tsconfig.node.json"],
]);

/** Default type environment for platform-neutral package declarations. */
const defaultEnvironmentConfig = "tsconfig.pure-core.json";

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
 * Returns the package role owning a declaration source file.
 *
 * @param {string} filePath Absolute TypeScript source path.
 * @returns {string} Owning package role.
 */
function packageRoleForFile(filePath) {
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
  if (diagnostics.length === 0) {
    return;
  }

  const formatted = ts.formatDiagnosticsWithColorAndContext(diagnostics, diagnosticHost);
  throw new Error(`Declaration build failed for '${packageRole}'.\n${formatted}`);
}

/**
 * Removes declaration artifacts recursively while preserving JavaScript output.
 *
 * @param {string} directory Package output directory.
 */
async function removeDeclarationOutputs(directory) {
  /** @type {import("node:fs").Dirent[]} */
  let entries;

  try {
    entries = await fs.readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return;
    }
    throw error;
  }

  await Promise.all(
    entries.map(async (entry) => {
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

  await removeDeclarationOutputs(outputRoot);

  const program = ts.createProgram({ options: compilerOptions, rootNames: [...sourceFiles] });
  assertNoDiagnostics(ts.getPreEmitDiagnostics(program), packageRole);

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
  const declarationConfig = parseConfig(declarationConfigPath);
  /** @type {Map<string, string[]>} */
  const sourcesByPackage = new Map();

  for (const sourceFile of declarationConfig.fileNames) {
    const packageRole = packageRoleForFile(sourceFile);
    const packageSources = sourcesByPackage.get(packageRole) ?? [];
    packageSources.push(sourceFile);
    sourcesByPackage.set(packageRole, packageSources);
  }

  const packageBuilds = [...sourcesByPackage.entries()]
    .sort(([leftRole], [rightRole]) => leftRole.localeCompare(rightRole))
    .map(([packageRole, sourceFiles]) =>
      buildPackageDeclarations(packageRole, sourceFiles.sort(), declarationConfig.options),
    );
  await Promise.all(packageBuilds);

  process.stdout.write(`Built declarations for ${packageBuilds.length} package entries.\n`);
}

await main();
