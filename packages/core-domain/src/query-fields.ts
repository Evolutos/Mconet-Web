// Copyright © 2026 Mcont.

import type { QueryField } from "./query-field.js";

/**
 * Ordered readonly occurrences of protocol-independent query fields.
 *
 * Array order is semantically significant and repeated case-sensitive names
 * remain separate entries. The collection does not merge values, perform
 * lookup, validate fields, percent-encode text, or serialize a URL; those
 * responsibilities remain with explicit validators, resolvers, and transports.
 */
export type QueryFields = readonly QueryField[];
