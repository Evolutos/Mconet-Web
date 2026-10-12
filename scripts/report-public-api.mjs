// Copyright © 2026 Mcont.

import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import ts from "typescript";

/** Workspace root resolved independently from the caller's current directory. */
const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Generated report of every package entry export. */
const reportPath = path.join(workspaceRoot, "docs", "api", "public-api.md");

/**
 * Reads named exports from one package entry.
 *
 * @param {string} filePath Package entry path.
 * @returns {Map<string, "type" | "value">} Export names.
 */
function readExports(filePath) {
  const sourceText = ts.sys.readFile(filePath);
  if (sourceText === undefined) {
    throw new Error(`Package entry is missing: ${filePath}`);
  }
  const sourceFile = ts.createSourceFile(
    filePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  /** @type {Map<string, "type" | "value">} */
  const exportsByName = new Map();
  for (const statement of sourceFile.statements) {
    if (
      !ts.isExportDeclaration(statement) ||
      statement.exportClause === undefined ||
      !ts.isNamedExports(statement.exportClause)
    ) {
      if (ts.isExportDeclaration(statement) && statement.moduleSpecifier === undefined) {
        continue;
      }
      throw new Error(`Unsupported export in ${filePath}.`);
    }
    for (const element of statement.exportClause.elements) {
      exportsByName.set(
        element.name.text,
        statement.isTypeOnly || element.isTypeOnly ? "type" : "value",
      );
    }
  }
  return exportsByName;
}

/**
 * Reads every package entry under packages.
 *
 * @returns {Promise<Map<string, Map<string, "type" | "value">>>} Exports by package.
 */
async function readPackageExports() {
  const packagesRoot = path.join(workspaceRoot, "packages");
  const entries = (await readdir(packagesRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  /** @type {Map<string, Map<string, "type" | "value">>} */
  const packages = new Map();
  for (const packageName of entries) {
    const entryPath = path.join(packagesRoot, packageName, "src", "index.ts");
    packages.set(packageName, readExports(entryPath));
  }
  return packages;
}

/**
 * Renders the public API report.
 *
 * @param {Map<string, Map<string, "type" | "value">>} packages Exports by package.
 * @returns {string} Markdown report.
 */
function renderReport(packages) {
  const sections = [...packages.entries()].map(([packageName, exportsByName]) => {
    const rows = [...exportsByName.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([name, kind]) => `| \`${packageName}\` | \`${name}\` | ${kind} |`)
      .join("\n");
    return `## ${packageName}\n\n| Package | Name | Kind |\n| --- | --- | --- |\n${rows}`;
  });
  return `# Public API\n\n${sections.join("\n\n")}\n`;
}

/**
 * Writes the report, or rejects a report that omits a current export.
 *
 * @param {boolean} checkOnly Whether to compare without writing.
 */
async function reportPublicApi(checkOnly) {
  const packages = await readPackageExports();
  if (!checkOnly) {
    await mkdir(path.dirname(reportPath), { recursive: true });
    await writeFile(reportPath, renderReport(packages));
    return;
  }
  const report = await readFile(reportPath, "utf8");
  for (const [packageName, exportsByName] of packages) {
    for (const name of exportsByName.keys()) {
      if (!new RegExp(`^\\| \`${packageName}\`\\s+\\| \`${name}\`\\s+\\|`, "mu").test(report)) {
        throw new Error(`The public API report is missing ${packageName}.${name}.`);
      }
    }
  }
}

const argument = process.argv[2];

if (process.argv.length > 3 || (argument !== undefined && argument !== "--check")) {
  throw new Error("Usage: node scripts/report-public-api.mjs [--check]");
}

await reportPublicApi(argument === "--check");
