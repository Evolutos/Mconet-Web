// Copyright © 2026 Mcont.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import ts from "typescript";

/** Workspace root resolved independently from the caller's current directory. */
const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Public client sources whose export names must stay aligned. */
const entryFiles = ["index.ts", "browser.ts", "node.ts"];

/** Generated reference checked back against those entries. */
const referencePath = path.join(workspaceRoot, "docs", "api", "client.md");

/**
 * Reads the exported names from one client entry.
 *
 * @param {string} fileName Entry file name.
 * @returns {Map<string, "type" | "value">} Export name and whether it is type-only.
 */
function readExports(fileName) {
  const filePath = path.join(workspaceRoot, "packages", "client", "src", fileName);
  const sourceText = ts.sys.readFile(filePath);
  if (sourceText === undefined) {
    throw new Error(`Client entry is missing: ${fileName}`);
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
      !statement.exportClause ||
      !ts.isNamedExports(statement.exportClause)
    ) {
      throw new Error(`Client entry ${fileName} has an unsupported export.`);
    }
    for (const element of statement.exportClause.elements) {
      const kind = statement.isTypeOnly || element.isTypeOnly ? "type" : "value";
      exportsByName.set(element.name.text, kind);
    }
  }

  return exportsByName;
}

/**
 * Renders the client reference from the default entry.
 *
 * @param {Map<string, "type" | "value">} exportsByName Default entry exports.
 * @returns {string} Markdown reference.
 */
function renderReference(exportsByName) {
  const rows = [...exportsByName.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, kind]) => `| \`${name}\` | ${kind} |`)
    .join("\n");

  return `# Client API

The default and browser entries bind the browser Fetch transport. The node entry binds the Node Fetch transport. The three entries export the same names.

| Name | Kind |
| --- | --- |
${rows}
`;
}

/**
 * Generates the reference, or rejects a document that has drifted from the entries.
 *
 * @param {boolean} checkOnly Whether to compare without writing.
 */
async function generateApiReference(checkOnly) {
  const entries = entryFiles.map((fileName) => ({
    fileName,
    exportsByName: readExports(fileName),
  }));
  const [defaultEntry, ...platformEntries] = entries;
  if (defaultEntry === undefined) {
    throw new Error("The client default entry is missing.");
  }

  const defaultNames = [...defaultEntry.exportsByName.keys()].sort();
  for (const entry of platformEntries) {
    const names = [...entry.exportsByName.keys()].sort();
    if (names.join("\n") !== defaultNames.join("\n")) {
      throw new Error(`Client entry ${entry.fileName} does not export the default entry names.`);
    }
  }

  const rendered = renderReference(defaultEntry.exportsByName);
  if (checkOnly) {
    const current = await readFile(referencePath, "utf8");
    const documented = new Set(
      [...current.matchAll(/^\| `([^`]+)`\s+\|/gmu)].map((match) => match[1]),
    );
    for (const name of defaultEntry.exportsByName.keys()) {
      if (!documented.has(name)) {
        throw new Error(`The client API reference is missing ${name}.`);
      }
    }
    if (documented.size !== defaultEntry.exportsByName.size) {
      throw new Error("The client API reference lists an export the entries do not have.");
    }
    return;
  }

  await mkdir(path.dirname(referencePath), { recursive: true });
  await writeFile(referencePath, rendered);
}

const argument = process.argv[2];

if (process.argv.length > 3 || (argument !== undefined && argument !== "--check")) {
  throw new Error("Usage: node scripts/generate-api-reference.mjs [--check]");
}

await generateApiReference(argument === "--check");
