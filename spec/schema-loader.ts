// Copyright © 2026 Mcont.

import fs from "node:fs/promises";
import type { Dirent } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Default directory containing language-neutral Mconet JSON Schema documents. */
const defaultSchemaDirectory = fileURLToPath(new URL("./schemas/", import.meta.url));

/** Filename suffix reserved for JSON Schema documents discovered by the loader. */
const schemaFileSuffix = ".schema.json";

/**
 * Loads one JSON Schema document by its exact, stable `$id` value.
 *
 * The loader discovers only files ending in `.schema.json`, verifies every
 * discovered document has a usable `$id`, rejects duplicate identifiers, and
 * returns a deeply frozen parsed object. It does not validate schema keywords or
 * compile validators; those responsibilities belong to the validator adapter.
 *
 * @param schemaId Exact `$id` of the requested Schema document.
 * @param schemaDirectory Root directory to search recursively.
 * @returns Deeply frozen Schema document with the requested identifier.
 * @throws {TypeError} When an identifier or discovered document is malformed.
 * @throws {SyntaxError} When a discovered Schema file is not valid JSON.
 * @throws {Error} When the directory cannot be read, an identifier is missing, or an identifier is duplicated.
 */
export async function loadSchemaById(
  schemaId: string,
  schemaDirectory: string = defaultSchemaDirectory,
): Promise<Readonly<Record<string, unknown>>> {
  // Reject ambiguous identifiers before touching the filesystem. Exact matching
  // must not silently trim or normalize caller input.
  assertStableSchemaId(schemaId, "Requested Schema identifier");

  // An empty directory argument would resolve to the caller's working directory
  // and unintentionally broaden discovery beyond the Schema registry.
  if (schemaDirectory.length === 0) {
    throw new TypeError("Schema directory must be non-empty.");
  }

  // Resolve once so discovery, diagnostics, and duplicate detection all use the
  // same absolute directory independent from the caller's working directory.
  const resolvedSchemaDirectory = path.resolve(schemaDirectory);
  const schemaFilePaths = await collectSchemaFilePaths(resolvedSchemaDirectory);
  let matchedSchema: Record<string, unknown> | undefined;
  const schemaPathById = new Map<string, string>();

  for (const schemaFilePath of schemaFilePaths) {
    // Parse every discovered document, including non-matches, so one malformed
    // registry entry cannot remain hidden based on which identifier was requested.
    const schema = await readSchemaDocument(schemaFilePath);
    const discoveredSchemaId = schema.$id;
    const existingSchemaPath = schemaPathById.get(discoveredSchemaId);

    // Every stable identifier in the registry must resolve to exactly one
    // document, even when the duplicate is not the identifier requested now.
    if (existingSchemaPath) {
      throw new Error(
        `Duplicate Schema identifier '${discoveredSchemaId}' in '${existingSchemaPath}' and '${schemaFilePath}'.`,
      );
    }
    schemaPathById.set(discoveredSchemaId, schemaFilePath);

    if (discoveredSchemaId === schemaId) {
      matchedSchema = schema;
    }
  }

  // Absence is explicit and stable; the loader never derives a filename from an
  // identifier or returns a different version as a fallback.
  if (!matchedSchema) {
    throw new Error(
      `Schema identifier '${schemaId}' was not found in '${resolvedSchemaDirectory}'.`,
    );
  }

  // The document was freshly parsed, so freezing it cannot affect shared caller
  // state and prevents later tests from mutating the loaded registry value.
  return freezeSchemaDocument(matchedSchema);
}

/**
 * Validates an exact Schema identifier without applying normalization.
 *
 * @param value Identifier to validate.
 * @param context Diagnostic label for the identifier source.
 * @throws {TypeError} When the identifier is empty or has surrounding whitespace.
 */
function assertStableSchemaId(value: string, context: string): void {
  // Stable identifiers must compare byte-for-byte across implementations; an
  // empty or implicitly trimmed identifier would make lookup behavior ambiguous.
  if (value.length === 0 || value.trim() !== value) {
    throw new TypeError(`${context} must be non-empty and contain no surrounding whitespace.`);
  }
}

/**
 * Recursively collects supported Schema files in deterministic path order.
 *
 * @param directoryPath Absolute directory currently being inspected.
 * @returns Sorted absolute paths for all nested `.schema.json` files.
 * @throws {Error} When the directory or a nested directory cannot be read.
 */
async function collectSchemaFilePaths(directoryPath: string): Promise<readonly string[]> {
  /** Directory entries retained with type information to avoid following symbolic links. */
  let entries: Dirent[];

  try {
    // Sorting the local entries makes traversal and duplicate diagnostics stable
    // across filesystems with different native enumeration orders.
    entries = (await fs.readdir(directoryPath, { withFileTypes: true })).sort((left, right) =>
      comparePathSegments(left.name, right.name),
    );
  } catch (error) {
    // Preserve the filesystem error as cause while exposing a stable operation-
    // level message to conformance tooling.
    throw new Error(`Unable to read Schema directory '${directoryPath}'.`, { cause: error });
  }

  const schemaFilePaths: string[] = [];
  for (const entry of entries) {
    const entryPath = path.join(directoryPath, entry.name);

    if (entry.isDirectory()) {
      // Append each already-sorted subtree in the current stable traversal order.
      schemaFilePaths.push(...(await collectSchemaFilePaths(entryPath)));
      continue;
    }

    // Ignore symbolic links and unrelated files. Only regular files bearing the
    // reviewed suffix participate in the Schema registry.
    if (entry.isFile() && entry.name.endsWith(schemaFileSuffix)) {
      schemaFilePaths.push(entryPath);
    }
  }

  return schemaFilePaths;
}

/**
 * Reads and validates the loader-level contract of one Schema document.
 *
 * @param schemaFilePath Absolute path of the Schema file.
 * @returns Parsed object containing a stable `$id` string.
 * @throws {Error} When the file cannot be read.
 * @throws {SyntaxError} When the source is not valid JSON.
 * @throws {TypeError} When the top level or `$id` is malformed.
 */
async function readSchemaDocument(
  schemaFilePath: string,
): Promise<Record<string, unknown> & { readonly $id: string }> {
  let source: string;

  try {
    // Read text explicitly as UTF-8 because JSON Schema artifacts are portable
    // text files and must not depend on the host's default encoding.
    source = await fs.readFile(schemaFilePath, "utf8");
  } catch (error) {
    throw new Error(`Unable to read Schema file '${schemaFilePath}'.`, { cause: error });
  }

  let parsed: unknown;
  try {
    // Keep parser output unknown until the loader-level object contract is
    // checked; JSON syntax alone does not prove the document can carry `$id`.
    parsed = JSON.parse(source) as unknown;
  } catch (error) {
    throw new SyntaxError(`Schema file '${schemaFilePath}' is not valid JSON.`, { cause: error });
  }

  if (!isRecord(parsed)) {
    throw new TypeError(`Schema file '${schemaFilePath}' must contain a JSON object.`);
  }

  // Require an own string `$id`; inherited values are impossible after JSON.parse
  // but the explicit check keeps this helper correct if its source changes later.
  const schemaId = parsed.$id;
  if (!Object.hasOwn(parsed, "$id") || typeof schemaId !== "string") {
    throw new TypeError(`Schema file '${schemaFilePath}' must contain a string '$id'.`);
  }
  assertStableSchemaId(schemaId, `Schema file '${schemaFilePath}' identifier`);

  // The explicit checks above establish the stronger internal return contract;
  // no schema keyword interpretation is implied by this narrowing.
  return parsed as Record<string, unknown> & { readonly $id: string };
}

/**
 * Narrows an unknown JSON value to a non-null, non-array record.
 *
 * @param value Runtime value to inspect.
 * @returns Whether the value is a record suitable for a Schema document.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  // Arrays and null are JSON values but cannot carry the named top-level Schema
  // fields required by identifier-based loading.
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Deeply freezes a freshly parsed Schema document.
 *
 * @param schema Parsed Schema object owned exclusively by this loader call.
 * @returns The same object with every nested array and object frozen.
 */
function freezeSchemaDocument(schema: Record<string, unknown>): Readonly<Record<string, unknown>> {
  // Freeze children first so callers cannot mutate a nested keyword value even
  // when the root object itself is already protected.
  freezeJsonContainer(schema);
  return schema;
}

/**
 * Recursively freezes JSON arrays and objects in place.
 *
 * @param value Parsed JSON value at the current traversal position.
 */
function freezeJsonContainer(value: unknown): void {
  if (Array.isArray(value)) {
    // JSON.parse cannot produce cycles, so every element can be traversed once
    // before the owning array is frozen.
    for (const item of value) {
      freezeJsonContainer(item);
    }
    Object.freeze(value);
    return;
  }

  if (!isRecord(value)) {
    // Primitives have no mutable container state.
    return;
  }

  // Object.values operates only on own enumerable JSON members and therefore
  // visits every nested container produced by JSON.parse.
  for (const nestedValue of Object.values(value)) {
    freezeJsonContainer(nestedValue);
  }
  Object.freeze(value);
}

/**
 * Compares path segments without locale-dependent collation.
 *
 * @param left First path segment.
 * @param right Second path segment.
 * @returns Negative, zero, or positive ordering result.
 */
function comparePathSegments(left: string, right: string): number {
  // UTF-16 code-unit ordering is deterministic across supported JavaScript
  // runtimes and needs no locale or filesystem-specific normalization.
  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }
  return 0;
}
