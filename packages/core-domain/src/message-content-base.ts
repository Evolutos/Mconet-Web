// Copyright © 2026 Mcont.

import type { Extensions } from "./extensions.js";
import type { JsonValue } from "./json-value.js";
import type { MessageContentKind } from "./message-content-kind.js";

/**
 * Package-internal immutable fields shared by message-content variants.
 *
 * Content is an ordered value owned by a message entry, not a message-tree
 * element. This base therefore carries only content identity, classification,
 * metadata, and extensions; it intentionally has no role, relations, children,
 * task data, transport state, authorization, or executable behavior.
 *
 * The interface is exported from its module so separately defined content
 * variants can extend it, but it is not exported from the package entry point.
 */
export interface MessageContentBase {
  /** Stable content identity within its containing message document. */
  readonly id: string;

  /** Standard or integration-defined content classification. */
  readonly kind: MessageContentKind;

  /** Always-present JSON-compatible application metadata. */
  readonly metadata: Readonly<Record<string, JsonValue>>;

  /** Always-present namespaced extensions for forward-compatible data. */
  readonly extensions: Extensions;
}
