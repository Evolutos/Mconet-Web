// Copyright © 2026 Mcont.

import type { ArtifactDescriptor } from "./artifact-descriptor.js";
import type { ArtifactKind } from "./artifact-kind.js";
import type { ArtifactMetadata } from "./artifact-metadata.js";
import type { ArtifactSource } from "./artifact-source.js";
import type { Extensions } from "./extensions.js";
import { parseMediaType } from "./media-type.js";
import { isJsonRecord } from "./model-descriptor.js";
import { isOpenIdentifier } from "./open-identifier.js";
import { isUriValue } from "./uri-value.js";

/**
 * Immutable data contract for one externally stored or inline Artifact.
 *
 * Identity and classification remain separate from source representation and
 * optional modality description. The contract preserves wire media-type text,
 * metadata, and extensions without reading, downloading, uploading, decoding,
 * converting, validating, or selecting runtime components.
 */
export interface Artifact {
  /** Catalog-local Artifact identity. */
  readonly id: string;

  /** Open Artifact classification with optional semantics and extensions. */
  readonly kind: ArtifactKind;

  /** Original media type text when the producing boundary supplied one. */
  readonly mediaType?: string;

  /** Inline or referenced representation from which Artifact data may be read. */
  readonly source: ArtifactSource;

  /** Optional modality-specific descriptive data. */
  readonly descriptor?: ArtifactDescriptor;

  /** Always-present JSON-compatible descriptive metadata. */
  readonly metadata: ArtifactMetadata;

  /** Always-present namespaced extension data for forward compatibility. */
  readonly extensions: Extensions;
}

/**
 * Determines whether an unknown value satisfies the Artifact data contract.
 *
 * The validator checks local identity and nested data shapes, including concrete
 * inline and URI source requirements. It validates media-type syntax but does
 * not normalize the retained text, resolve a Catalog reference, access source
 * bytes or URIs, infer modality, or enforce Catalog-wide identity uniqueness.
 *
 * @param value Untrusted value to validate.
 * @returns Whether the value is a valid {@link Artifact}.
 */
export function isArtifact(value: unknown): value is Artifact {
  const descriptors = getRecordDescriptors(value);
  if (descriptors === undefined) {
    // Non-records and hostile reflection failures cannot satisfy the named
    // Artifact contract and fail closed without invoking user accessors.
    return false;
  }

  const idDescriptor = descriptors.id;
  const kindDescriptor = descriptors.kind;
  const sourceDescriptor = descriptors.source;
  const metadataDescriptor = descriptors.metadata;
  const extensionsDescriptor = descriptors.extensions;

  // Required fields must be own data properties. Optional fields use exact
  // absence semantics, so present undefined values are rejected.
  return (
    isDataDescriptor(idDescriptor) &&
    isOpenIdentifier(idDescriptor.value) &&
    isDataDescriptor(kindDescriptor) &&
    isArtifactKindValue(kindDescriptor.value) &&
    isOptionalMediaTypeDescriptor(descriptors.mediaType) &&
    isDataDescriptor(sourceDescriptor) &&
    isArtifactSourceValue(sourceDescriptor.value) &&
    isOptionalArtifactDescriptor(descriptors.descriptor) &&
    isDataDescriptor(metadataDescriptor) &&
    isJsonRecord(metadataDescriptor.value, new Set<object>()) &&
    isDataDescriptor(extensionsDescriptor) &&
    isJsonRecord(extensionsDescriptor.value, new Set<object>())
  );
}

/** Captures own descriptors for a non-array object without invoking accessors. */
function getRecordDescriptors(value: unknown): Record<string, PropertyDescriptor> | undefined {
  if (typeof value !== "object" || value === null) {
    // Primitives and null cannot expose the named fields required by Artifact.
    return undefined;
  }

  try {
    // Artifact records and nested contracts are objects, never root arrays.
    return Array.isArray(value) ? undefined : Object.getOwnPropertyDescriptors(value);
  } catch {
    // Revoked or hostile Proxies are invalid boundary input rather than errors
    // that may escape validation.
    return undefined;
  }
}

/** Checks that a property descriptor stores a value rather than an accessor. */
function isDataDescriptor(
  descriptor: PropertyDescriptor | undefined,
): descriptor is PropertyDescriptor & { readonly value: unknown } {
  // Presence of the descriptor's value key distinguishes stored undefined from
  // getter/setter properties without executing user code.
  return descriptor !== undefined && "value" in descriptor;
}

/** Validates the open ArtifactKind data object without interpreting its meaning. */
function isArtifactKindValue(value: unknown): value is ArtifactKind {
  const descriptors = getRecordDescriptors(value);
  if (descriptors === undefined) {
    // Kinds are structured values rather than bare identifier strings.
    return false;
  }

  const idDescriptor = descriptors.id;
  const extensionsDescriptor = descriptors.extensions;
  // Optional semantic text remains distinct from absent data, while kind
  // extensions must remain recursively JSON-compatible.
  return (
    isDataDescriptor(idDescriptor) &&
    isOpenIdentifier(idDescriptor.value) &&
    isOptionalStringDescriptor(descriptors.semantic) &&
    isDataDescriptor(extensionsDescriptor) &&
    isJsonRecord(extensionsDescriptor.value, new Set<object>())
  );
}

/** Validates an absent media type or one syntactically valid retained string. */
function isOptionalMediaTypeDescriptor(descriptor: PropertyDescriptor | undefined): boolean {
  if (descriptor === undefined) {
    // True absence is valid and does not invent a default media type.
    return true;
  }

  // Parsing checks syntax without replacing the caller's original string with
  // normalized structural output.
  return (
    isDataDescriptor(descriptor) &&
    typeof descriptor.value === "string" &&
    parseMediaType(descriptor.value) !== undefined
  );
}

/** Validates one known or integration-defined ArtifactSource representation. */
function isArtifactSourceValue(value: unknown): value is ArtifactSource {
  const descriptors = getRecordDescriptors(value);
  if (descriptors === undefined) {
    // Sources must expose a named kind rather than a bare string or byte value.
    return false;
  }

  const kindDescriptor = descriptors.kind;
  if (!isDataDescriptor(kindDescriptor) || !isOpenIdentifier(kindDescriptor.value)) {
    // Every standard and custom source requires one valid open discriminator.
    return false;
  }

  if (kindDescriptor.value === "artifact.source.inline") {
    const bytesDescriptor = descriptors.bytes;
    try {
      // Inline sources must own a Uint8Array view. Validation observes neither
      // byte contents nor backing-buffer size and performs no copy.
      return isDataDescriptor(bytesDescriptor) && bytesDescriptor.value instanceof Uint8Array;
    } catch {
      // Hostile values that fail the platform brand check are invalid.
      return false;
    }
  }

  if (kindDescriptor.value === "artifact.source.uri") {
    const uriDescriptor = descriptors.uri;
    // URI sources require the explicit absolute/relative value object. Syntax
    // validation never resolves, normalizes, downloads, or authorizes the URI.
    return isDataDescriptor(uriDescriptor) && isUriValue(uriDescriptor.value);
  }

  // Unknown source kinds remain open for integrations. Their additional fields
  // belong to the defining integration and are not interpreted by core-domain.
  return true;
}

/** Validates true absence or one ArtifactDescriptor data property. */
function isOptionalArtifactDescriptor(descriptor: PropertyDescriptor | undefined): boolean {
  if (descriptor === undefined) {
    // Artifact modality description is optional and receives no fabricated kind.
    return true;
  }
  if (!isDataDescriptor(descriptor)) {
    // Accessors and present undefined values cannot satisfy exact optional data.
    return false;
  }

  const descriptors = getRecordDescriptors(descriptor.value);
  const kindDescriptor = descriptors?.kind;
  // Concrete descriptors may add fields, but every descriptor starts with one
  // valid open kind and no descriptor behavior is executed here.
  return isDataDescriptor(kindDescriptor) && isOpenIdentifier(kindDescriptor.value);
}

/** Validates true absence or an own string data property. */
function isOptionalStringDescriptor(descriptor: PropertyDescriptor | undefined): boolean {
  // Exact optional semantics reject accessors and explicit undefined while
  // preserving any supplied string, including an empty semantic description.
  return (
    descriptor === undefined ||
    (isDataDescriptor(descriptor) && typeof descriptor.value === "string")
  );
}
