// Copyright © 2026 Mcont.

import {
  ModelInteractionError,
  type ArtifactCatalog,
  type MessageDocument,
} from "@evolutos/mconet-core-domain";
import type { ErasedRuntimeValue, MessageRequestMapper } from "@evolutos/mconet-core-spi";

import { mapMessageDocumentToWire } from "./map-message-document.js";
import type { OpenAIChatMessageDTO } from "./openai-chat-message-dto.js";

/** Stable code when an image cannot be placed in Ollama `images`. */
const unsupportedArtifactSourceCode = "unsupported_artifact_source";

/** Marker between a data URI media type and its base64 payload. */
const base64Marker = ";base64,";

/** Diagnostic name of the injectable Ollama message mapper. */
const mapperName = "ollama.chat-message-request-mapper";

/** Descriptive version of this mapper. */
const mapperVersion = "1.0.0";

/** Semantic identity of the fragment this mapper returns. */
const ollamaMessagesTypeId = "protocol.ollama.chat-messages";

/** Capabilities declared by this mapper. Native chat messages add none. */
const mapperCapabilities: MessageRequestMapper["descriptor"]["capabilities"] = new Set();

/**
 * One native Ollama `/api/chat` message.
 *
 * `images` holds raw base64 payloads, not data URIs. It is omitted when the
 * message has no image.
 */
export interface OllamaChatMessage {
  /** Wire role spelling. */
  readonly role: string;

  /** Text content. Image parts are not repeated here. */
  readonly content: string;

  /** Base64 image payloads, in content order. */
  readonly images?: readonly string[];
}

/**
 * Injectable message mapper that writes Ollama `/api/chat` messages.
 *
 * The default chat adapter does not use this mapper. A caller injects it when
 * the request body should carry `images` instead of OpenAI `image_url` parts.
 * Text stays in `content`. Each data-URI image contributes its base64 payload.
 * A remote URL is rejected: this mapper does not fetch. URI artifacts must
 * already be inline bytes before `mapRequest` runs.
 */
export class OllamaChatMessageRequestMapper implements MessageRequestMapper {
  /** Immutable component metadata. */
  public readonly descriptor: MessageRequestMapper["descriptor"] = Object.freeze({
    name: mapperName,
    version: mapperVersion,
    capabilities: mapperCapabilities,
    source: "builtin",
  });

  /**
   * Maps one message document to Ollama chat messages.
   *
   * @param document Message tree to map.
   * @param catalog Catalog that resolves image references in `document`.
   * @returns An erased fragment whose `value` is the native message list.
   * @throws ModelInteractionError When an image URL is not a base64 data URI.
   */
  public mapRequest(document: MessageDocument, catalog: ArtifactCatalog): ErasedRuntimeValue {
    // The general chat mapping writes image_url first. This injected mapper
    // only changes that message shape. It does not fetch or choose a protocol.
    const messages = mapMessageDocumentToWire(document, catalog).map((message) =>
      ollamaMessage(message),
    );
    return {
      typeId: ollamaMessagesTypeId,
      value: messages,
    };
  }
}

/**
 * Writes one chat message as an Ollama `/api/chat` message.
 *
 * @param message Chat-completions message, including image parts when present.
 * @returns The native message.
 * @throws ModelInteractionError When an image URL is not a base64 data URI.
 */
function ollamaMessage(message: OpenAIChatMessageDTO): OllamaChatMessage {
  const parts = message.contentParts;
  // A text-only message has no parts. Leaving content as the string keeps
  // the native body identical to a message that never carried an image.
  if (parts === undefined) {
    return { role: message.role, content: message.content };
  }
  const images: string[] = [];
  const texts: string[] = [];
  for (const part of parts) {
    if (part.type === "text") {
      texts.push(part.text);
      continue;
    }
    // Image bytes move to images and are not repeated in content. A remote
    // URL has no payload; the runtime must already have stored inline bytes.
    const payload = base64Payload(part.url);
    if (payload === undefined) {
      throw new ModelInteractionError({
        message: "Ollama /api/chat images require base64 bytes, not a remote URL.",
        category: "unsupported_feature",
        phase: "protocol_adaptation",
        code: unsupportedArtifactSourceCode,
        diagnostics: [],
      });
    }
    images.push(payload);
  }
  return {
    role: message.role,
    content: texts.join(""),
    ...(images.length === 0 ? {} : { images }),
  };
}

/**
 * Returns the base64 payload of a data URI.
 *
 * @param url Image URL written for `image_url`.
 * @returns The payload, or `undefined` when `url` is not a base64 data URI.
 */
function base64Payload(url: string): string | undefined {
  // The data-URI prefix is not part of the native images array. An empty
  // payload is not a zero-length image; it is an unreadable source.
  const markerIndex = url.indexOf(base64Marker);
  if (!url.startsWith("data:") || markerIndex < 0) {
    return undefined;
  }
  const payload = url.slice(markerIndex + base64Marker.length);
  return payload.length === 0 ? undefined : payload;
}
