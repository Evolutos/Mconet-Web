// Copyright © 2026 Mcont.

import type { JsonPrimitive } from "./json-primitive.js";

/**
 * Recursively representable JSON data.
 *
 * Arrays and objects are readonly so domain contracts cannot imply that input
 * data may be mutated after construction. Runtime validation must still reject
 * cycles, non-finite numbers, unsupported prototypes, and unsafe object keys.
 */
export type JsonValue =
  JsonPrimitive | readonly JsonValue[] | { readonly [key: string]: JsonValue };
