// Copyright © 2026 Mcont.

import type { MessageContent } from "./message-content.js";
import type { MessageElementBase } from "./message-element-base.js";
import type { MessageRole } from "./message-role.js";

/**
 * Immutable leaf message element carrying one participant's ordered content.
 *
 * The fixed kind distinguishes entries from message containers. Content remains
 * an ordered collection of MessageContent values rather than child tree nodes;
 * the interface intentionally declares no children, task parameters, endpoint,
 * authorization, model, protocol, or execution fields.
 */
export interface MessageEntry extends MessageElementBase {
  /** Fixed discriminator for a leaf message entry. */
  readonly kind: "message.entry";

  /** Participant role associated with every content value in this entry. */
  readonly role: MessageRole;

  /** Ordered content values owned by this leaf element. */
  readonly content: readonly MessageContent[];
}
