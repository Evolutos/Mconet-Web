// Copyright © 2026 Mcont.

import type { MessageContentBase } from "./message-content-base.js";
import { isJsonRecord } from "./model-descriptor.js";
import { isOpenIdentifier } from "./open-identifier.js";

/**
 * Immutable message content that points at one catalog-local Artifact.
 *
 * The content stores only the artifact identity. Bytes, URIs, and media type
 * stay on the Artifact in the containing catalog, so this value never embeds a
 * source, reads bytes, or fetches a URI.
 */
export interface ArtifactMessageContent extends MessageContentBase {
  /** Fixed discriminator for a catalog reference carried as message content. */
  readonly kind: "content.artifact";

  /** Artifact identity resolved only against the containing request or result catalog. */
  readonly artifactId: string;
}

/**
 * Determines whether an unknown value is artifact message content.
 *
 * The guard checks the shared content fields and one open `artifactId`. It does
 * not resolve that identity, inspect a catalog, or read an artifact source.
 *
 * @param value Untrusted value to validate.
 * @returns Whether the value is {@link ArtifactMessageContent}.
 */
export function isArtifactMessageContent(value: unknown): value is ArtifactMessageContent {
  // Arrays and primitives are not content records. A throwing descriptor read
  // fails closed so a hostile proxy cannot escape the guard.
  if (typeof value !== "object" || value === null) {
    return false;
  }

  let descriptors: Record<string, PropertyDescriptor>;
  try {
    if (Array.isArray(value)) {
      return false;
    }
    descriptors = Object.getOwnPropertyDescriptors(value);
  } catch {
    return false;
  }

  const idDescriptor = descriptors.id;
  const kindDescriptor = descriptors.kind;
  const artifactIdDescriptor = descriptors.artifactId;
  const metadataDescriptor = descriptors.metadata;
  const extensionsDescriptor = descriptors.extensions;

  // Kind is required before artifactId so another content kind cannot pass by
  // merely owning an identifier. The id is not resolved against a catalog here.
  return (
    isDataDescriptor(idDescriptor) &&
    isOpenIdentifier(idDescriptor.value) &&
    isDataDescriptor(kindDescriptor) &&
    kindDescriptor.value === "content.artifact" &&
    isDataDescriptor(artifactIdDescriptor) &&
    isOpenIdentifier(artifactIdDescriptor.value) &&
    isDataDescriptor(metadataDescriptor) &&
    isJsonRecord(metadataDescriptor.value, new Set<object>()) &&
    isDataDescriptor(extensionsDescriptor) &&
    isJsonRecord(extensionsDescriptor.value, new Set<object>())
  );
}

/** Checks that a property descriptor stores a value rather than an accessor. */
function isDataDescriptor(
  descriptor: PropertyDescriptor | undefined,
): descriptor is PropertyDescriptor & { readonly value: unknown } {
  return descriptor !== undefined && "value" in descriptor;
}
