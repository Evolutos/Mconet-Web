// Copyright © 2026 Mcont.

import type { HeaderField } from "./header-field.js";

/**
 * Ordered readonly occurrences of protocol-independent header fields.
 *
 * Array order is semantically significant and repeated normalized names remain
 * separate entries. The collection does not coalesce values, perform lookup,
 * validate fields, or apply platform serialization rules; those responsibilities
 * remain with explicit validators, resolvers, and transports.
 */
export type HeaderFields = readonly HeaderField[];
