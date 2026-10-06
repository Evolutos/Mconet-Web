// Copyright © 2026 Mcont.

import type { OpenIdentifier } from "./open-identifier.js";

/**
 * Open identifier classifying one message-content value.
 *
 * The listed literals form the standard cross-language vocabulary. The open
 * identifier arm preserves kinds introduced by integrations or future SDK
 * versions while retaining editor completion for standard values. Declaring a
 * kind does not imply that the current runtime can encode, send, or render it;
 * runtime scope and untrusted-input validation remain separate concerns.
 */
export type MessageContentKind =
  | "content.text"
  | "content.json"
  | "content.artifact"
  | "content.unknown"
  | (OpenIdentifier & Record<never, never>);
