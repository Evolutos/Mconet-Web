// Copyright © 2026 Mcont.

import {
  MessageDocumentBuilder,
  ModelInteractionError,
  type Artifact,
  type ArtifactCatalog,
  type MessageEntry,
  type MessageGroup,
} from "@evolutos/mconet-core-domain";
import type {
  ErasedRuntimeValue,
  MessageMappingResult,
  MessageResponseMapper,
} from "@evolutos/mconet-core-spi";

import { decodeBase64ToBytes, mediaTypeFromImageMagic } from "./image-bytes.js";
import { mapChoicesToMessageDocument } from "./map-choices.js";
import { mapWireRoleToDomain } from "./map-message-role.js";
import { mapWireTextToDomain } from "./map-text-message-content.js";
import { mapWireChoiceToMessageEntry } from "./map-wire-choice.js";
import { OpenAIChatCompletionResponseDTO } from "./openai-chat-completion-response-dto.js";
import { type OpenAIChatMessageDTO } from "./openai-chat-message-dto.js";
import { childPath } from "./wire.js";

/** Diagnostic name of the chat message response mapper. */
const mapperName = "openai-compatible.chat-message-response-mapper";

/** Descriptive version of this mapper. */
const mapperVersion = "1.0.0";

/** Message schema version written on every recovered document. */
const messageDocumentVersion = "1.0";

/** Purpose of a document built from response choices. */
const outputPurpose = "output";

/** Root identity. It stays distinct from choice entry ids. */
const outputRootId = "output";

/** Root kind required by the message document contract. */
const messageRootKind = "message.root";

/** Container composition required on the output root. */
const containerComposition = "container";

/** Fixed entry kind. */
const messageEntryKind = "message.entry";

/** Content kind that points at a recovered image. */
const artifactContentKind = "content.artifact";

/** Artifact kind written for a recovered image. */
const imageArtifactKindId = "artifact.image";

/** Prefix for an entry id derived from the choice index. */
const choiceEntryIdPrefix = "choice-";

/** Stable code when image bytes in a response cannot be decoded. */
const invalidImageContentCode = "invalid_image_content";

/** Shared empty relations. */
const emptyRelations: MessageGroup["relations"] = Object.freeze([]);

/** Shared empty metadata. */
const emptyMetadata: MessageGroup["metadata"] = Object.freeze({});

/** Shared empty extensions. */
const emptyExtensions: MessageGroup["extensions"] = Object.freeze({});

/** Shared empty artifact catalog for a text-only response. */
const emptyArtifacts: ArtifactCatalog = Object.freeze({ artifacts: Object.freeze([]) });

/** Capabilities declared by this mapper. Chat recovery adds none. */
const mapperCapabilities: MessageResponseMapper["descriptor"]["capabilities"] = new Set();

/**
 * Recovers chat-completions messages and any image parts into the message domain.
 *
 * A text-only body keeps the existing choice document and an empty catalog.
 * An `image_url` part becomes `content.artifact` plus a catalog image: data
 * URIs are stored as inline bytes, and http(s) URLs are stored as URI sources.
 * This mapper does not fetch those URLs.
 */
export class OpenAIChatMessageResponseMapper implements MessageResponseMapper {
  /** Immutable component metadata. */
  public readonly descriptor: MessageResponseMapper["descriptor"] = Object.freeze({
    name: mapperName,
    version: mapperVersion,
    capabilities: mapperCapabilities,
    source: "builtin",
  });

  /**
   * Maps one decoded chat-completions success value.
   *
   * @param fragment Decoded response payload. `value` is the success JSON or DTO.
   * @returns The message document and the images it references.
   * @throws ModelInteractionError When the body has no choices, repeated indexes, or an image part that cannot be stored.
   */
  public mapResponse(fragment: ErasedRuntimeValue): MessageMappingResult {
    const response = readResponse(fragment.value);
    // A text-only body keeps the existing choice document and an empty catalog,
    // so content ids stay `choice-N-text`. Image recovery starts only when at
    // least one part is an image.
    if (!hasImagePart(response)) {
      return {
        document: mapChoicesToMessageDocument(response.choices),
        artifacts: emptyArtifacts,
      };
    }

    const artifacts: Artifact[] = [];
    const children: MessageEntry[] = [];
    const seenIndexes = new Set<number>();
    for (const choice of response.choices) {
      if (seenIndexes.has(choice.index)) {
        throw new ModelInteractionError({
          message: `OpenAI-compatible response choice index ${choice.index} is duplicated.`,
          category: "protocol",
          phase: "response_parsing",
          code: "duplicate_choice_index",
          diagnostics: [],
        });
      }
      seenIndexes.add(choice.index);
      const parts = choice.message.contentParts;
      // A choice that itself has no image still uses the text entry mapper, so
      // a mixed response does not renumber that choice's text content.
      if (parts === undefined || !parts.some((part) => part.type === "image_url")) {
        children.push(mapWireChoiceToMessageEntry(choice));
        continue;
      }
      children.push(entryFromParts(choice.index, choice.message, artifacts));
    }

    const root: MessageGroup = {
      id: outputRootId,
      kind: messageRootKind,
      composition: containerComposition,
      children,
      relations: emptyRelations,
      metadata: emptyMetadata,
      extensions: emptyExtensions,
    };
    return {
      document: new MessageDocumentBuilder(messageDocumentVersion, outputPurpose, root).build(),
      artifacts: { artifacts },
    };
  }
}

/** Reads a response DTO from a class instance or plain JSON. */
function readResponse(value: unknown): OpenAIChatCompletionResponseDTO {
  if (value instanceof OpenAIChatCompletionResponseDTO) {
    return value;
  }
  return OpenAIChatCompletionResponseDTO.fromJson(value);
}

/** Reports whether any choice carries an image part. */
function hasImagePart(response: OpenAIChatCompletionResponseDTO): boolean {
  return response.choices.some((choice) =>
    choice.message.contentParts?.some((part) => part.type === "image_url"),
  );
}

/**
 * Builds one entry whose content follows the wire part order.
 *
 * @param index Choice index. It supplies entry and content ids.
 * @param message Choice message whose parts are recovered in order.
 * @param artifacts Catalog under construction. Image parts are appended.
 * @returns A frozen entry.
 */
function entryFromParts(
  index: number,
  message: OpenAIChatMessageDTO,
  artifacts: Artifact[],
): MessageEntry {
  // Part order is the content order. Text and image ids include the part
  // index so two parts in one choice do not share an id.
  const parts = message.contentParts ?? [];
  const rolePath = childPath(childPath(childPath("", "choices"), String(index)), "message");
  const content: MessageEntry["content"][number][] = [];
  for (let partIndex = 0; partIndex < parts.length; partIndex += 1) {
    const part = parts[partIndex];
    if (part === undefined) {
      continue;
    }
    if (part.type === "text") {
      content.push(
        mapWireTextToDomain(part.text, `${choiceEntryIdPrefix}${index}-text-${partIndex}`),
      );
      continue;
    }
    const artifactId = `${choiceEntryIdPrefix}${index}-image-${partIndex}`;
    artifacts.push(artifactFromImageUrl(part.url, artifactId));
    content.push(
      Object.freeze({
        id: `${choiceEntryIdPrefix}${index}-artifact-${partIndex}`,
        kind: artifactContentKind,
        artifactId,
        metadata: emptyMetadata,
        extensions: emptyExtensions,
      }),
    );
  }
  if (content.length === 0) {
    throw new ModelInteractionError({
      message: "Response message content did not contain text or an image.",
      category: "protocol",
      phase: "response_parsing",
      code: invalidImageContentCode,
      diagnostics: [],
    });
  }
  const toolCalls = message.toolCalls;
  return Object.freeze({
    id: `${choiceEntryIdPrefix}${index}`,
    kind: messageEntryKind,
    role: mapWireRoleToDomain(message.role, childPath(rolePath, "role")),
    content: Object.freeze(content),
    relations: emptyRelations,
    metadata: emptyMetadata,
    extensions: emptyExtensions,
    ...(message.toolCallId === undefined ? {} : { toolCallId: message.toolCallId }),
    ...(toolCalls === undefined ? {} : { toolCalls: Object.freeze([...toolCalls]) }),
  });
}

/**
 * Stores one response image URL as an artifact.
 *
 * A data URI is decoded into inline bytes. An http(s) URL is kept as a URI
 * source. Neither form is fetched.
 *
 * @param url `image_url.url` from the response.
 * @param id Catalog-local artifact id.
 * @returns The artifact.
 */
function artifactFromImageUrl(url: string, id: string): Artifact {
  // Parsing does not fetch. A data URI becomes inline bytes; an http(s) URL
  // stays a URI source for a later reader.
  if (url.startsWith("data:")) {
    return artifactFromDataUrl(url, id);
  }
  if (url.startsWith("https://") || url.startsWith("http://")) {
    return Object.freeze({
      id,
      kind: Object.freeze({ id: imageArtifactKindId, extensions: emptyExtensions }),
      source: Object.freeze({
        kind: "artifact.source.uri",
        uri: Object.freeze({ kind: "absolute", value: url }),
      }),
      metadata: emptyMetadata,
      extensions: emptyExtensions,
    });
  }
  throw imageError("Response image_url is not a data URI or an absolute http(s) URL.");
}

/**
 * Decodes a base64 data URI into an inline image artifact.
 *
 * @param url Data URI.
 * @param id Catalog-local artifact id.
 * @returns The artifact.
 */
function artifactFromDataUrl(url: string, id: string): Artifact {
  const comma = url.indexOf(",");
  const header = comma > "data:".length ? url.slice("data:".length, comma) : "";
  const payload = comma >= 0 ? url.slice(comma + 1) : "";
  if (!header.includes("base64") || payload.length === 0) {
    throw imageError("Response image data URI must carry base64 bytes.");
  }
  const bytes = decodeBase64ToBytes(payload);
  if (bytes === undefined) {
    throw imageError("Response image data URI is not valid base64.");
  }
  const declared = header.replace(/;base64$/, "");
  // Prefer the type declared in the URI. Magic is only a fallback when that
  // declaration is not an image type.
  const mediaType = declared.startsWith("image/") ? declared : mediaTypeFromImageMagic(bytes);
  return Object.freeze({
    id,
    kind: Object.freeze({ id: imageArtifactKindId, extensions: emptyExtensions }),
    ...(mediaType === undefined ? {} : { mediaType }),
    source: Object.freeze({ kind: "artifact.source.inline", bytes }),
    metadata: emptyMetadata,
    extensions: emptyExtensions,
  });
}

/** Returns a protocol error for one image part. */
function imageError(message: string): ModelInteractionError {
  return new ModelInteractionError({
    message,
    category: "protocol",
    phase: "response_parsing",
    code: invalidImageContentCode,
    diagnostics: [],
  });
}
