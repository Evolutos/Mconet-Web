// Copyright © 2026 Mcont.

import {
  isTextMessageContent,
  ModelInteractionError,
  type MessageContent,
  type TextMessageContent,
} from "@evolutos/mconet-core-domain";

/** Stable code for request content the text protocol has no place for. */
const unsupportedMessageContentCode = "unsupported_message_content";

/** Standard kind of the only content this protocol can carry. */
const textContentKind = "content.text";

/** Shared empty metadata. Frozen so one output content cannot alter another. */
const emptyMetadata: Readonly<Record<string, never>> = Object.freeze({});

/** Shared empty extensions. Frozen for the same reason as the metadata. */
const emptyExtensions: Readonly<Record<string, never>> = Object.freeze({});

/**
 * Returns the exact wire text for one request content value.
 *
 * The chat completions text protocol has a single string slot per message, so
 * only standard text content can be sent. Any other kind fails instead of being
 * skipped: dropping it would silently change what the model is asked.
 *
 * @param content One content value of a request message entry.
 * @returns `content.text` without trimming, normalization, or newline changes.
 * @throws ModelInteractionError With code `unsupported_message_content` when the
 *   content is not valid text content.
 */
export function mapTextMessageContentToWire(content: MessageContent): string {
  // Reuse the domain guard so a lookalike value that only claims the text kind
  // (missing text, accessor-backed text) is not read as text.
  if (isTextMessageContent(content)) {
    return content.text;
  }
  // The kind identifier is SDK-side request data and tells the caller which
  // content needs a different representation. The payload is never copied.
  const kind = typeof content.kind === "string" ? content.kind : "";
  throw new ModelInteractionError({
    message: `Message content kind ${kind} is not supported by the OpenAI-compatible chat completions protocol.`,
    category: "unsupported_feature",
    phase: "protocol_adaptation",
    code: unsupportedMessageContentCode,
    diagnostics: [],
  });
}

/**
 * Creates the standard text content for one response message string.
 *
 * The text is kept exactly as received, including the empty string, Unicode,
 * and line breaks. Identity is supplied by the caller so the same response
 * always yields the same content id.
 *
 * @param text Exact `content` string of a response message.
 * @param id Document-local identity for the content.
 * @returns Frozen text content with empty metadata and extensions.
 */
export function mapWireTextToDomain(text: string, id: string): TextMessageContent {
  // The kind literal is the domain discriminator. This mapper never produces
  // another kind, so no separate unknown-content path exists on this side.
  return Object.freeze({
    id,
    kind: textContentKind,
    text,
    metadata: emptyMetadata,
    extensions: emptyExtensions,
  });
}
