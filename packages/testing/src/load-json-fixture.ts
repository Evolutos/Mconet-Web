// Copyright © 2026 Mcont.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Loads one local JSON Fixture without asserting an application-level type.
 *
 * Callers provide a module-relative file URL so resolution never depends on the
 * process working directory. The loader accepts only unqualified local `.json`
 * files, reads UTF-8 text, and preserves the parsed value as `unknown` until a
 * Schema validator or a domain validator establishes its runtime contract.
 *
 * @param fixtureUrl Exact local URL of the JSON Fixture to load.
 * @returns Freshly parsed JSON data with no inferred application-level type.
 * @throws {TypeError} When the input is not an unqualified local `.json` URL.
 * @throws {Error} When the Fixture cannot be read.
 * @throws {SyntaxError} When the Fixture does not contain valid JSON.
 */
export async function loadJsonFixture(fixtureUrl: URL): Promise<unknown> {
  // Validate the runtime boundary as well as the TypeScript signature because
  // JavaScript consumers can call the published helper without static checks.
  if (!(fixtureUrl instanceof URL)) {
    throw new TypeError("Fixture URL must be a URL instance.");
  }

  // Restrict loading to local files. Network retrieval, data URLs, redirects,
  // and authorization are outside a deterministic Fixture utility's scope.
  if (fixtureUrl.protocol !== "file:") {
    throw new TypeError("Fixture URL must use the 'file:' protocol.");
  }

  // Queries and fragments do not identify filesystem bytes and could make two
  // distinct URL strings silently load the same file.
  if (fixtureUrl.search.length > 0 || fixtureUrl.hash.length > 0) {
    throw new TypeError("Fixture URL must not contain a query or fragment.");
  }

  // Convert through the platform helper so encoded separators and unsupported
  // file-URL hosts are rejected according to Node's cross-platform rules.
  const fixturePath = fileURLToPath(fixtureUrl);
  if (path.extname(fixturePath) !== ".json") {
    throw new TypeError("Fixture URL must identify a file ending in '.json'.");
  }

  let source: string;
  try {
    // An explicit encoding returns text directly and prevents host-default
    // decoding from changing language-neutral Fixture bytes.
    source = await fs.readFile(fixturePath, "utf8");
  } catch (error) {
    // Retain the original filesystem error as cause while exposing a stable,
    // operation-level message that identifies the exact failed Fixture.
    throw new Error(`Unable to read Fixture '${fixturePath}'.`, { cause: error });
  }

  try {
    // Keep parser output unknown: valid JSON syntax does not prove any Schema or
    // domain type, and the loader must not offer an unchecked generic cast.
    return JSON.parse(source) as unknown;
  } catch (error) {
    // Normalize parser wording across Node releases without discarding the
    // native SyntaxError used for low-level diagnostics.
    throw new SyntaxError(`Fixture '${fixturePath}' is not valid JSON.`, { cause: error });
  }
}
