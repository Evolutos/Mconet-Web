// Copyright © 2026 Mcont.

import type { MessageContentBase } from "./message-content-base.js";
import { isJsonRecord } from "./model-descriptor.js";
import { isOpenIdentifier } from "./open-identifier.js";

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

/**
 * Determines whether an unknown value satisfies the text-content contract.
 *
 * Empty text is valid and no implicit model or protocol limit is applied. When
 * supplied, `maximumCodePoints` is an inclusive non-negative safe-integer limit
 * measured with JavaScript's Unicode string iterator, not UTF-16 code units or
 * UTF-8 bytes. Validation preserves the input without trimming, normalization,
 * or line-ending conversion.
 *
 * @param value Untrusted value to validate.
 * @param maximumCodePoints Optional inclusive Unicode code-point limit.
 * @returns Whether the value and optional length policy are valid.
 */
export function isTextMessageContent(
  value: unknown,
  maximumCodePoints?: number,
): value is TextMessageContent {
  // Reject an invalid explicit policy before inspecting content. Zero remains a
  // valid boundary for an empty string, while unsafe integers are non-portable.
  if (
    maximumCodePoints !== undefined &&
    (!Number.isSafeInteger(maximumCodePoints) || maximumCodePoints < 0)
  ) {
    return false;
  }

  // Text content is a named record. Keep array detection and descriptor
  // reflection guarded because both can fail for a revoked Proxy.
  if (typeof value !== "object" || value === null) {
    return false;
  }

  let descriptors: Record<string, PropertyDescriptor>;
  try {
    // Capture every own descriptor without executing known or unknown getters.
    if (Array.isArray(value)) {
      return false;
    }
    descriptors = Object.getOwnPropertyDescriptors(value);
  } catch {
    // Hostile reflection failures represent invalid boundary data.
    return false;
  }

  const idDescriptor = descriptors.id;
  const kindDescriptor = descriptors.kind;
  const textDescriptor = descriptors.text;
  const metadataDescriptor = descriptors.metadata;
  const extensionsDescriptor = descriptors.extensions;

  // Every declared field is required as an own data property. The identifier
  // and both JSON maps reuse the package's established portable validators.
  if (
    !isDataDescriptor(idDescriptor) ||
    !isOpenIdentifier(idDescriptor.value) ||
    !isDataDescriptor(kindDescriptor) ||
    kindDescriptor.value !== "content.text" ||
    !isDataDescriptor(textDescriptor) ||
    typeof textDescriptor.value !== "string" ||
    !isDataDescriptor(metadataDescriptor) ||
    !isJsonRecord(metadataDescriptor.value, new Set<object>()) ||
    !isDataDescriptor(extensionsDescriptor) ||
    !isJsonRecord(extensionsDescriptor.value, new Set<object>())
  ) {
    return false;
  }

  // With no explicit limit, all string lengths are valid at the domain layer.
  // Otherwise stop as soon as the inclusive code-point boundary is exceeded.
  return (
    maximumCodePoints === undefined ||
    !exceedsCodePointLimit(textDescriptor.value, maximumCodePoints)
  );
}

/** Checks that a property descriptor stores a value rather than an accessor. */
function isDataDescriptor(
  descriptor: PropertyDescriptor | undefined,
): descriptor is PropertyDescriptor & { readonly value: unknown } {
  // The descriptor-level key distinguishes stored undefined from a getter.
  return descriptor !== undefined && "value" in descriptor;
}

/** Determines whether a string exceeds an inclusive Unicode code-point limit. */
function exceedsCodePointLimit(value: string, maximumCodePoints: number): boolean {
  const codePoints = value[Symbol.iterator]();
  let nextCodePoint = codePoints.next();
  let count = 0;

  while (!nextCodePoint.done) {
    // The native string iterator advances by Unicode code point, so a valid
    // surrogate pair such as an emoji contributes one position.
    count += 1;
    if (count > maximumCodePoints) {
      return true;
    }
    nextCodePoint = codePoints.next();
  }

  return false;
}
