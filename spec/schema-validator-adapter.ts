// Copyright © 2026 Mcont.

import type { ValidateFunction } from "ajv";
import { Ajv2020 } from "ajv/dist/2020.js";
import type { FormatsPlugin } from "ajv-formats";
import { createRequire } from "node:module";

/** Module-relative CommonJS loader for the locked ajv-formats package. */
const requireFromModule = createRequire(import.meta.url);

/** Typed ajv-formats plugin loaded without repository-wide synthetic interop. */
const addFormats = requireFromModule("ajv-formats") as FormatsPlugin;

/** Canonical JSON Schema dialect supported by the conformance adapter. */
const supportedSchemaDialect = "https://json-schema.org/draft/2020-12/schema";

/** Standard formats required by current cross-language base value contracts. */
const supportedFormats = ["date-time", "duration", "uri", "uri-reference"] as const;

/**
 * Adapts one loaded JSON Schema document to a synchronous boolean validator.
 *
 * Each adapter compiles exactly one draft 2020-12 Schema. Ajv-specific errors
 * remain behind this boundary, validation never coerces or mutates Fixture data,
 * and unsupported asynchronous Schemas fail during construction.
 */
export class SchemaValidatorAdapter {
  /** Stable identifier included in adapter-level error messages. */
  readonly #schemaId: string;

  /** Compiled synchronous validator owned only by this adapter instance. */
  readonly #validator: ValidateFunction<unknown>;

  /**
   * Compiles one loaded Schema into a reusable validator.
   *
   * @param schema Deeply immutable Schema document produced by the Schema loader.
   * @throws {TypeError} When the Schema identity, dialect, or execution mode is unsupported.
   * @throws {Error} When strict JSON Schema compilation fails.
   */
  constructor(schema: Readonly<Record<string, unknown>>) {
    // Validate the loader-level identity again at the adapter boundary so direct
    // construction cannot bypass the stable identifier contract.
    const schemaId = schema.$id;
    if (typeof schemaId !== "string" || schemaId.length === 0 || schemaId.trim() !== schemaId) {
      throw new TypeError("Schema validator requires a stable string '$id'.");
    }

    // A dedicated Ajv class is required for draft 2020-12. Reject missing or
    // older dialect declarations instead of silently interpreting them as 2020.
    if (schema.$schema !== supportedSchemaDialect) {
      throw new TypeError(`Schema '${schemaId}' must declare dialect '${supportedSchemaDialect}'.`);
    }

    // The conformance interface is deliberately synchronous; accepting an async
    // Schema would make a boolean result depend on untracked external behavior.
    if (schema.$async === true) {
      throw new TypeError(`Schema '${schemaId}' must not enable asynchronous validation.`);
    }

    this.#schemaId = schemaId;

    try {
      // Compile once during construction so malformed Schemas fail before any
      // Fixture is evaluated and repeated validations reuse the same code.
      this.#validator = createValidatorEngine().compile<unknown>(schema);
    } catch (error) {
      // Hide Ajv-specific error classes while retaining the original failure as
      // cause for local debugging.
      throw new Error(`Unable to compile Schema '${schemaId}'.`, { cause: error });
    }
  }

  /**
   * Validates one runtime value without changing it.
   *
   * @param value Fixture or parsed JSON value to validate.
   * @returns Whether the value satisfies the compiled Schema.
   * @throws {Error} When generated validation code fails or returns asynchronously.
   */
  validate(value: unknown): boolean {
    let result: boolean | Promise<unknown>;

    try {
      // Ajv returns false for ordinary validation failures. Exceptions represent
      // execution failures and are normalized separately below.
      result = this.#validator(value);
    } catch (error) {
      throw new Error(`Unable to validate value against Schema '${this.#schemaId}'.`, {
        cause: error,
      });
    }

    // Constructor checks reject a top-level async Schema, but this defensive
    // guard also covers an unexpected asynchronous compiled result.
    if (typeof result !== "boolean") {
      throw new Error(`Schema '${this.#schemaId}' produced an asynchronous validation result.`);
    }

    return result;
  }
}

/**
 * Creates one strictly configured draft 2020-12 validation engine.
 *
 * @returns Ajv engine with mutation disabled and reviewed standard formats installed.
 */
function createValidatorEngine(): Ajv2020 {
  // Explicit mutation options protect callers even if Ajv defaults change in a
  // later reviewed upgrade. ownProperties excludes inherited input members.
  const engine = new Ajv2020({
    allErrors: true,
    coerceTypes: false,
    ownProperties: true,
    removeAdditional: false,
    strict: true,
    useDefaults: false,
  });

  // Register only formats used by current base contracts. Full validation keeps
  // range checks for date/time values instead of the simplified fast mode.
  addFormats(engine, {
    formats: [...supportedFormats],
    keywords: false,
    mode: "full",
  });

  return engine;
}
