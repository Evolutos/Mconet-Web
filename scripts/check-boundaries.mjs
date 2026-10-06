// Copyright © 2026 Mcont.

import { builtinModules } from "node:module";
import path from "node:path";
import process from "node:process";
import ts from "typescript";

/** Workspace root resolved independently from the caller's current directory. */
const workspaceRoot = path.resolve(import.meta.dirname, "..");

/** Directory containing every governed workspace package. */
const packagesRoot = path.join(workspaceRoot, "packages");

/** Canonical npm scope prefix for internal package imports. */
const internalPackagePrefix = "@evolutos/mconet-";

/**
 * Allowed internal dependency targets for each package role.
 *
 * Self-imports are handled separately. Any internal dependency not listed for
 * the importing package is rejected, which makes newly added packages closed
 * by default until their architecture boundary is reviewed.
 */
const allowedDependencies = new Map([
  ["auth-basic", new Set(["core-spi"])],
  [
    "client",
    new Set([
      "auth-basic",
      "codec-json",
      "core-runtime",
      "integration-openai-compatible",
      "transport-fetch-browser",
    ]),
  ],
  ["codec-json", new Set(["core-spi"])],
  ["core-domain", new Set()],
  ["core-runtime", new Set(["core-domain", "core-spi"])],
  ["core-spi", new Set(["core-domain"])],
  ["integration-openai-compatible", new Set(["core-domain", "core-spi"])],
  ["testing", new Set(["core-domain", "core-runtime", "core-spi"])],
  ["transport-fetch-browser", new Set(["core-spi"])],
  ["transport-fetch-node", new Set(["core-spi"])],
]);

/** Node.js built-in specifiers in both bare and explicit `node:` forms. */
const nodeBuiltinSpecifiers = new Set(
  builtinModules.flatMap((moduleName) => [moduleName, `node:${moduleName}`]),
);

/**
 * Returns the workspace package role that owns a source file.
 *
 * @param {string} filePath Absolute source file path.
 * @returns {string | undefined} Package role, or undefined outside packages.
 */
function packageRoleForFile(filePath) {
  const relativePath = path.relative(packagesRoot, filePath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    return undefined;
  }

  const [packageRole] = relativePath.split(path.sep);
  return packageRole || undefined;
}

/**
 * Resolves an internal npm or cross-package relative import to its package role.
 *
 * @param {string} specifier Module specifier from source code.
 * @param {string} sourceFile Absolute importing file path.
 * @returns {string | undefined} Target role when the import is internal.
 */
function internalTargetRole(specifier, sourceFile) {
  if (specifier.startsWith(internalPackagePrefix)) {
    const packageReference = specifier.slice(internalPackagePrefix.length);
    const [packageRole] = packageReference.split("/");
    return packageRole || undefined;
  }

  if (!specifier.startsWith(".")) {
    return undefined;
  }

  return packageRoleForFile(path.resolve(path.dirname(sourceFile), specifier));
}

/**
 * Collects every literal module specifier and rejects non-literal dynamic imports.
 *
 * @param {ts.SourceFile} sourceFile Parsed TypeScript source.
 * @returns {{ node: ts.Node, specifier?: string, issue?: string }[]} Imports found.
 */
function collectImports(sourceFile) {
  /** @type {{ node: ts.Node, specifier?: string, issue?: string }[]} */
  const imports = [];

  /**
   * Visits one syntax node and records import-bearing constructs.
   *
   * @param {ts.Node} node Current syntax node.
   */
  function visit(node) {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteralLike(node.moduleSpecifier)
    ) {
      imports.push({ node: node.moduleSpecifier, specifier: node.moduleSpecifier.text });
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference) &&
      node.moduleReference.expression &&
      ts.isStringLiteralLike(node.moduleReference.expression)
    ) {
      imports.push({
        node: node.moduleReference.expression,
        specifier: node.moduleReference.expression.text,
      });
    } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
      const literal = node.argument.literal;
      if (ts.isStringLiteralLike(literal)) {
        imports.push({ node: literal, specifier: literal.text });
      }
    } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const [argument] = node.arguments;
      if (argument && ts.isStringLiteralLike(argument)) {
        imports.push({ node: argument, specifier: argument.text });
      } else {
        imports.push({ node, issue: "Dynamic imports must use a string literal specifier." });
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return imports;
}

/**
 * Formats a source location for deterministic command-line diagnostics.
 *
 * @param {ts.SourceFile} sourceFile Parsed source file.
 * @param {ts.Node} node Node that violates a boundary.
 * @returns {string} Workspace-relative `file:line:column` location.
 */
function sourceLocation(sourceFile, node) {
  const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  return `${path.relative(workspaceRoot, sourceFile.fileName)}:${position.line + 1}:${position.character + 1}`;
}

/**
 * Checks one TypeScript source file against the reviewed dependency graph.
 *
 * @param {string} filePath Absolute source file path.
 * @returns {string[]} Human-readable boundary violations.
 */
function checkSourceFile(filePath) {
  const sourcePackage = packageRoleForFile(filePath);
  if (!sourcePackage) {
    return [`${path.relative(workspaceRoot, filePath)}: source is outside a workspace package.`];
  }

  const allowedTargets = allowedDependencies.get(sourcePackage);
  if (!allowedTargets) {
    return [
      `${path.relative(workspaceRoot, filePath)}: package '${sourcePackage}' has no boundary rule.`,
    ];
  }

  const sourceText = ts.sys.readFile(filePath);
  if (sourceText === undefined) {
    return [`${path.relative(workspaceRoot, filePath)}: source file could not be read.`];
  }

  const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true);
  /** @type {string[]} */
  const violations = [];

  for (const imported of collectImports(sourceFile)) {
    const location = sourceLocation(sourceFile, imported.node);
    if (imported.issue) {
      violations.push(`${location}: ${imported.issue}`);
      continue;
    }

    const specifier = imported.specifier;
    if (!specifier) {
      continue;
    }

    if (sourcePackage === "transport-fetch-browser" && nodeBuiltinSpecifiers.has(specifier)) {
      violations.push(
        `${location}: browser transport cannot import Node.js built-in '${specifier}'.`,
      );
      continue;
    }

    const targetPackage = internalTargetRole(specifier, filePath);
    if (targetPackage && targetPackage !== sourcePackage && !allowedTargets.has(targetPackage)) {
      violations.push(
        `${location}: package '${sourcePackage}' cannot import '${targetPackage}' via '${specifier}'.`,
      );
    }
  }

  return violations;
}

/**
 * Runs the repository boundary check and reports every violation in one pass.
 */
function main() {
  const sourceFiles = ts.sys
    .readDirectory(packagesRoot, [".cts", ".mts", ".ts", ".tsx"], undefined, ["*/src/**/*"])
    .sort();
  const violations = sourceFiles.flatMap(checkSourceFile);

  if (violations.length > 0) {
    for (const violation of violations) {
      process.stderr.write(`${violation}\n`);
    }
    process.exitCode = 1;
    return;
  }

  process.stdout.write(`Import boundary check passed for ${sourceFiles.length} source files.\n`);
}

main();
