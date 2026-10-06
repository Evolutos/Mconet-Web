// Copyright © 2026 Mcont.

import type { MessageElementBase } from "./message-element-base.js";
import type { MessageEntry } from "./message-entry.js";
import type { OpenIdentifier } from "./open-identifier.js";

/**
 * Immutable container in the ordered Message tree.
 *
 * A group may contain nested groups and leaf entries, but never MessageContent
 * directly. The explicit container composition distinguishes tree structure
 * from entry content while the open kind preserves standard, integration-defined,
 * and future grouping semantics. Validation owns ID uniqueness and cycle policy.
 */
export interface MessageGroup extends MessageElementBase {
  /** Standard or integration-defined container classification. */
  readonly kind: "message.root" | "message.group" | (OpenIdentifier & Record<never, never>);

  /** Fixed structural role distinguishing this element as a container. */
  readonly composition: "container";

  /** Ordered nested groups and leaf message entries. */
  readonly children: readonly (MessageGroup | MessageEntry)[];
}
