// Copyright © 2026 Mcont.

import { isArtifactMessageContent } from "./artifact-message-content.js";
import type { Artifact } from "./artifact.js";
import { isArtifact } from "./artifact.js";
import type { ArtifactCatalog } from "./artifact-catalog.js";
import { validateArtifactCatalogIds } from "./artifact-catalog.js";
import type { ConversationInputNode } from "./conversation-input-node.js";
import type { Diagnostic } from "./diagnostic.js";
import type { InlineArtifactSource } from "./inline-artifact-source.js";
import type { MessageDocument } from "./message-document.js";
import type { MessageEntry } from "./message-entry.js";
import type { MessageGroup } from "./message-group.js";
import { parseMediaType } from "./media-type.js";
import type { ProcessingResult } from "./processing-result.js";
import { resolveArtifactReference } from "./artifact-reference.js";
import type { TaskDocument } from "./task-document.js";
import type { TaskNode } from "./task-node.js";
import { isTextMessageContent } from "./text-message-content.js";
import type { UriArtifactSource } from "./uri-artifact-source.js";

/** Conversation input leaf. Other leaves are not message sources. */
const conversationInputKind = "task.input.conversation";

/** Container composition. Groups are walked; they are not themselves messages. */
const containerComposition = "container";

/** Message content that carries plain text. */
const textContentKind = "content.text";

/** Message content that names one catalog artifact. */
const artifactContentKind = "content.artifact";

/** Artifact classification this execution path can send and recover. */
const imageArtifactKindId = "artifact.image";

/** Source that already holds the image bytes. */
const inlineSourceKind = "artifact.source.inline";

/** Source that names a URI the runtime can read before the model request. */
const uriSourceKind = "artifact.source.uri";

/** Top-level media type required for an inline image. */
const imageMediaType = "image";

/** Absolute HTTP(S) URI without userinfo. Userinfo would be sent to the origin. */
const httpUrlWithUserInfo = /^https?:\/\/[^/?#]*@/u;

/** Absolute HTTP(S) URI with a host. */
const absoluteHttpUrl = /^https?:\/\/[^/?#]+/u;

/** Data URI whose payload is already base64 image bytes. */
const inlineDataImage = /^data:image\/[A-Za-z0-9.+-]+;base64,/u;

/** Message-tree element visited while collecting artifact references. */
type MessageElement = MessageGroup | MessageEntry;

/**
 * Validates that a conversation may carry text plus referenced image artifacts.
 *
 * Text content is unchanged. `content.artifact` is accepted only when
 * `artifactId` resolves to an `artifact.image` in this catalog, and every
 * catalog image must be referenced by at least one such content value. Other
 * content kinds and other artifact kinds fail before a credential is read.
 * This function does not read bytes, fetch a URI, or modify either value.
 *
 * @param document Task document whose conversation leaves carry messages.
 * @param catalog Request-local artifact scope for those messages.
 * @returns Both inputs, or one diagnostic and no value.
 */
export function validateImageArtifactSupport(
  document: TaskDocument,
  catalog: ArtifactCatalog,
): ProcessingResult<{ readonly document: TaskDocument; readonly catalog: ArtifactCatalog }> {
  // Duplicate catalog ids fail before any message is read. A later reference
  // cannot choose which of two same-id artifacts is the image.
  const identity = validateArtifactCatalogIds(catalog);
  if (identity.value === undefined) {
    return { diagnostics: identity.diagnostics };
  }

  // Every catalog member must already be a sendable image. Message content
  // cannot make a non-image artifact valid by pointing at it.
  for (let index = 0; index < catalog.artifacts.length; index += 1) {
    const rejection = rejectUnsupportedArtifact(catalog.artifacts[index], index);
    if (rejection !== undefined) {
      return { diagnostics: [rejection] };
    }
  }

  // Containers are walked and are not themselves messages. References are
  // collected across every conversation leaf before the unreferenced check,
  // so an image used only in a later document still counts.
  const referenced = new Set<string>();
  const pending: Array<{ readonly node: TaskNode; readonly path: string }> = [
    { node: document.root, path: "root" },
  ];
  let frame = pending.pop();
  while (frame !== undefined) {
    if (isConversationInput(frame.node)) {
      const failure = collectImageReferences(
        frame.node.messages,
        `${frame.path}.messages`,
        catalog,
        referenced,
      );
      if (failure !== undefined) {
        return { diagnostics: [failure] };
      }
    } else if (frame.node.composition === containerComposition && "children" in frame.node) {
      for (let index = frame.node.children.length - 1; index >= 0; index -= 1) {
        const child = frame.node.children[index];
        if (child !== undefined) {
          pending.push({ node: child, path: `${frame.path}.children[${index}]` });
        }
      }
    }
    frame = pending.pop();
  }

  // An image that no content value names would be omitted from the request.
  // Fail it here instead of dropping it silently.
  for (let index = 0; index < catalog.artifacts.length; index += 1) {
    const artifact = catalog.artifacts[index];
    if (artifact !== undefined && !referenced.has(artifact.id)) {
      return {
        diagnostics: [
          {
            code: "unreferenced_artifact",
            severity: "error",
            phase: "validation",
            message: "Each image artifact must be referenced by message content.",
            path: `artifacts[${index}]`,
            details: { artifactId: artifact.id },
          },
        ],
      };
    }
  }

  return {
    diagnostics: [],
    value: { document, catalog },
  };
}

/** Narrows one task node to a conversation input leaf. */
function isConversationInput(node: TaskNode): node is ConversationInputNode {
  return node.kind === conversationInputKind && node.composition === "leaf";
}

/**
 * Rejects one catalog value that this path cannot send as an image.
 *
 * @param artifact Catalog member at `index`.
 * @param index Position in the catalog.
 * @returns A diagnostic, or `undefined` when the artifact is a supported image.
 */
function rejectUnsupportedArtifact(
  artifact: Artifact | undefined,
  index: number,
): Diagnostic | undefined {
  if (artifact === undefined || !isArtifact(artifact)) {
    return unsupported(
      `artifacts[${index}]`,
      "Artifacts are not supported by this execution path.",
    );
  }
  if (artifact.kind.id !== imageArtifactKindId) {
    return unsupported(
      `artifacts[${index}].kind`,
      "Only image artifacts are supported by this execution path.",
      { artifactKind: artifact.kind.id },
    );
  }
  // Inline bytes without an image media type fail on mediaType. The source
  // is already inline, so the source-shape message would name the wrong field.
  if (isInlineSource(artifact.source) && !isImageMediaType(artifact.mediaType)) {
    return unsupported(
      `artifacts[${index}].mediaType`,
      "Inline image artifacts require an image media type.",
    );
  }
  if (!isSupportedImageSource(artifact)) {
    return unsupported(
      `artifacts[${index}].source`,
      "Image artifacts must use inline bytes or an absolute http(s) or data URI.",
    );
  }
  return undefined;
}

/**
 * Accepts inline image bytes or an absolute http(s) or data image URI.
 *
 * Relative URIs and non-image schemes stay unsupported so a later reader does
 * not invent a base URI or fetch `file:`.
 *
 * @param artifact Image artifact whose source is inspected, not read.
 * @returns Whether the source can be placed on a chat request.
 */
function isSupportedImageSource(artifact: Artifact): boolean {
  if (isInlineSource(artifact.source)) {
    return isImageMediaType(artifact.mediaType);
  }
  // A relative URI has no base in this layer. Rejecting it here keeps a later
  // reader from inventing one or fetching file:.
  if (!isUriSource(artifact.source) || artifact.source.uri.kind !== "absolute") {
    return false;
  }
  // A URI may omit media type because a later read can discover it. A declared
  // non-image type is already a contradiction and is not fetched.
  if (artifact.mediaType !== undefined && !isImageMediaType(artifact.mediaType)) {
    return false;
  }
  const uri = artifact.source.uri.value;
  if (inlineDataImage.test(uri)) {
    return true;
  }
  // Userinfo would be sent to the origin. The URL is rejected rather than
  // stripped, so the caller sees the source that failed.
  return absoluteHttpUrl.test(uri) && !httpUrlWithUserInfo.test(uri);
}

/** Narrows one source to caller-supplied bytes. */
function isInlineSource(source: Artifact["source"]): source is InlineArtifactSource {
  return (
    source.kind === inlineSourceKind && "bytes" in source && source.bytes instanceof Uint8Array
  );
}

/** Narrows one source to a URI reference. */
function isUriSource(source: Artifact["source"]): source is UriArtifactSource {
  return source.kind === uriSourceKind && "uri" in source;
}

/** Requires a parsed media type whose top-level type is `image`. */
function isImageMediaType(value: string | undefined): boolean {
  if (value === undefined) {
    return false;
  }
  return parseMediaType(value)?.type === imageMediaType;
}

/**
 * Records image references in one message document.
 *
 * @param document Conversation message tree.
 * @param path Path of that tree inside the task document.
 * @param catalog Catalog those references resolve against.
 * @param referenced Artifact ids seen so far.
 * @returns The first content diagnostic, or `undefined` when every content value is supported.
 */
function collectImageReferences(
  document: MessageDocument,
  path: string,
  catalog: ArtifactCatalog,
  referenced: Set<string>,
): Diagnostic | undefined {
  const pending: Array<{ readonly element: MessageElement; readonly path: string }> = [
    { element: document.root, path: `${path}.root` },
  ];
  let frame = pending.pop();
  while (frame !== undefined) {
    if ("content" in frame.element) {
      for (let index = 0; index < frame.element.content.length; index += 1) {
        const content = frame.element.content[index];
        const contentPath = `${frame.path}.content[${index}]`;
        if (content === undefined) {
          return unsupported(contentPath, "Only text and image artifact references are supported.");
        }
        // Text needs no catalog entry. Any other kind is outside this path.
        if (isTextMessageContent(content) && content.kind === textContentKind) {
          continue;
        }
        if (!isArtifactMessageContent(content) || content.kind !== artifactContentKind) {
          return unsupported(
            contentPath,
            "Only text and image artifact references are supported by this execution path.",
            { contentKind: content.kind },
          );
        }
        const resolved = resolveArtifactReference(
          { artifactId: content.artifactId, metadata: {} },
          catalog,
        );
        if (resolved.value === undefined) {
          return (
            resolved.diagnostics[0] ??
            unsupported(contentPath, "The referenced image was not found.")
          );
        }
        if (resolved.value.kind.id !== imageArtifactKindId) {
          return unsupported(contentPath, "Message content can reference only an image artifact.", {
            artifactId: content.artifactId,
          });
        }
        // Record the id only after it resolves to an image, so the
        // unreferenced check sees images that messages actually use.
        referenced.add(content.artifactId);
      }
    } else {
      for (let index = frame.element.children.length - 1; index >= 0; index -= 1) {
        const child = frame.element.children[index];
        if (child !== undefined) {
          pending.push({ element: child, path: `${frame.path}.children[${index}]` });
        }
      }
    }
    frame = pending.pop();
  }
  return undefined;
}

/**
 * Returns one validation diagnostic for content this path will not send.
 *
 * @param path Field that failed.
 * @param message Technical summary that does not include image bytes or URIs.
 * @param details Optional JSON facts such as a kind or artifact id.
 * @returns The diagnostic.
 */
function unsupported(path: string, message: string, details?: Record<string, string>): Diagnostic {
  return {
    code: "unsupported_message_content",
    severity: "error",
    phase: "validation",
    message,
    path,
    ...(details === undefined ? {} : { details }),
  };
}
