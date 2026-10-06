// Copyright © 2026 Mcont.

import type { JsonValue } from "./json-value.js";
import type { OpenIdentifier } from "./open-identifier.js";

/**
 * Immutable directed relation between two message-element identities.
 *
 * Source and target are stable IDs resolved within the containing message
 * document; the relation never embeds element objects or crosses into task-node
 * semantics. Its open type and JSON metadata preserve integration-defined
 * meaning without introducing callbacks, traversal behavior, or mutable state.
 */
export interface MessageRelation {
  /** Stable ID of the message element where the directed relation originates. */
  readonly sourceId: string;

  /** Stable ID of the message element where the directed relation terminates. */
  readonly targetId: string;

  /** Standard or integration-defined relationship classification. */
  readonly type: OpenIdentifier;

  /** Always-present JSON-compatible data describing this relationship. */
  readonly metadata: Readonly<Record<string, JsonValue>>;
}
