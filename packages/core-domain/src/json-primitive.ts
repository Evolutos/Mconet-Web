// Copyright © 2026 Mcont.

/**
 * Primitive values representable directly by the JSON data model.
 *
 * The number branch is a TypeScript shape only. Runtime JSON validation must
 * still reject non-finite numbers before encoding or accepting untrusted data.
 */
export type JsonPrimitive = string | number | boolean | null;
