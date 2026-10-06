// Copyright © 2026 Mcont.

import type { JsonValue } from "./json-value.js";

/**
 * Namespaced, JSON-compatible extension data carried by domain contracts.
 *
 * The map is readonly to prevent consumers from treating extensions as shared
 * mutable state. Namespace ownership and runtime value validation remain the
 * responsibility of the boundary that accepts the data.
 */
export type Extensions = Readonly<Record<string, JsonValue>>;
