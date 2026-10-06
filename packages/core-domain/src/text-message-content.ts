// Copyright © 2026 Mcont.

import type { MessageContentBase } from "./message-content-base.js";

/**
 * Immutable plain-text content carried by one message entry.
 *
 * The literal kind provides the future MessageContent union discriminator. Text
 * remains an exact JavaScript string, preserving empty values, Unicode, emoji,
 * and line breaks without normalization. Runtime length and acceptance policy
 * belong to the dedicated validator rather than this representation contract.
 */
export interface TextMessageContent extends MessageContentBase {
  /** Fixed discriminator for plain-text message content. */
  readonly kind: "content.text";

  /** Plain text preserved exactly as supplied by the caller or integration. */
  readonly text: string;
}
