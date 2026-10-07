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
  ["codec-json", new Set(["core-domain", "core-spi"])],
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
  // Resolve ownership relative to the fixed packages root rather than trusting
  // the caller's working directory or a textual path prefix.
  const relativePath = path.relative(packagesRoot, filePath);

  // Paths that escape the root, including cross-drive absolute paths, have no
  // workspace package owner.
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    return undefined;
  }

  // The first relative segment is the package role by workspace layout.
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
  // Scoped package imports encode their target role immediately after the
  // canonical internal prefix, including imports of package subpaths.
  if (specifier.startsWith(internalPackagePrefix)) {
    const packageReference = specifier.slice(internalPackagePrefix.length);
    const [packageRole] = packageReference.split("/");
    return packageRole || undefined;
  }

  // Bare third-party and platform imports are not internal package edges.
  if (!specifier.startsWith(".")) {
    return undefined;
  }

  // Resolve relative imports from the importing file and map the result back to
  // a workspace owner; same-package imports are handled by the caller.
  return packageRoleForFile(path.resolve(path.dirname(sourceFile), specifier));
}

/**
 * Collects every literal module specifier and rejects non-literal dynamic imports.
 *
 * @param {ts.SourceFile} sourceFile Parsed TypeScript source.
 * @returns {{ node: ts.Node, specifier?: string, issue?: string }[]} Imports found.
 */
function collectImports(sourceFile) {
  // Accumulate syntax nodes as well as text so later diagnostics retain exact
  // source positions without reparsing the file.
  /** @type {{ node: ts.Node, specifier?: string, issue?: string }[]} */
  const imports = [];

  /**
   * Visits one syntax node and records import-bearing constructs.
   *
   * @param {ts.Node} node Current syntax node.
   */
  function visit(node) {
    // Cover static import/export declarations, import-equals, import types, and
    // dynamic imports. Only dynamic imports may be non-literal, and those are
    // recorded as explicit violations rather than ignored.
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

    // Continue depth-first traversal so nested import types and dynamic imports
    // inside expressions are included in the same deterministic pass.
    ts.forEachChild(node, visit);
  }

  // Seed traversal at the source root, then return imports in syntax order.
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
  // TypeScript reports zero-based coordinates; CLI diagnostics use conventional
  // one-based line and column values with a workspace-relative path.
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
  // Establish the source package and its reviewed allowlist before reading or
  // parsing file content; ungoverned locations fail closed.
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

  // Parse the file once and collect every violation so one command reports all
  // actionable edges instead of stopping at the first failure.
  const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true);
  /** @type {string[]} */
  const violations = [];

  for (const imported of collectImports(sourceFile)) {
    const location = sourceLocation(sourceFile, imported.node);
    // Syntax-level import issues already contain their stable diagnostic text.
    if (imported.issue) {
      violations.push(`${location}: ${imported.issue}`);
      continue;
    }

    // Defensive narrowing keeps malformed collector records from becoming
    // accidental dependency decisions.
    const specifier = imported.specifier;
    if (!specifier) {
      continue;
    }

    // Browser transport has an additional platform boundary independent of the
    // workspace package dependency graph.
    if (sourcePackage === "transport-fetch-browser" && nodeBuiltinSpecifiers.has(specifier)) {
      violations.push(
        `${location}: browser transport cannot import Node.js built-in '${specifier}'.`,
      );
      continue;
    }

    // Reject cross-package edges absent from the source role's explicit set;
    // same-package and external imports remain outside this rule.
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
  // Discover governed source files in stable order, then evaluate every file so
  // the report is deterministic across platforms and executions.
  const sourceFiles = ts.sys
    .readDirectory(packagesRoot, [".cts", ".mts", ".ts", ".tsx"], undefined, ["*/src/**/*"])
    .sort();
  const violations = sourceFiles.flatMap(checkSourceFile);

  // Emit all findings and set a failing exit status without hiding later
  // violations behind an early exception.
  if (violations.length > 0) {
    for (const violation of violations) {
      process.stderr.write(`${violation}\n`);
    }
    process.exitCode = 1;
    return;
  }

  // A successful summary records the exact number of governed source files.
  process.stdout.write(`Import boundary check passed for ${sourceFiles.length} source files.\n`);
}

main();
