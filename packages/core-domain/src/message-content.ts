// Copyright © 2026 Mcont.

import type { TextMessageContent } from "./text-message-content.js";
import type { UnknownMessageContent } from "./unknown-message-content.js";

/**
 * Immutable message content supported by the current public domain model.
 *
 * Text has a typed payload, while Unknown preserves every other standard,
 * integration-defined, or future kind without semantic coercion. Because the
 * unknown kind vocabulary is intentionally open, consumers narrow text content
 * by the presence of its required `text` payload rather than kind equality alone.
 */
export type MessageContent = TextMessageContent | UnknownMessageContent;
