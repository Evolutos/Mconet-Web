// Copyright © 2026 Mcont.

/**
 * Immutable URI reference represented without exposing a mutable platform URL.
 *
 * The discriminator preserves whether resolution against a base URI is needed.
 * Syntax, encoding, scheme, and trust-boundary checks belong to the dedicated
 * validator; this type stores the original validated reference without rewrite.
 */
export type UriValue =
  | {
      readonly kind: "absolute";
      readonly value: string;
    }
  | {
      readonly kind: "relative";
      readonly value: string;
    };

/** RFC 3986 URI characters excluding percent-triplet validation. */
const uriCharacters = /^[A-Za-z0-9\-._~:/?#[\]@!$&'()*+,;=%]*$/u;

/** URI scheme followed by its required colon delimiter. */
const absoluteScheme = /^[A-Za-z][A-Za-z0-9+.-]*:/u;

/** Percent signs that do not begin exactly two hexadecimal digits. */
const invalidPercentEncoding = /%(?![A-Fa-f0-9]{2})/u;

/**
 * Determines whether an unknown value is a syntactically valid URI reference.
 *
 * The discriminator must agree with the string form. Validation follows the
 * ASCII URI character model and preserves the original string; it does not
 * resolve a relative reference, normalize encoding, or apply a scheme allowlist.
 *
 * @param input Untrusted value to validate.
 * @returns Whether the input is a valid {@link UriValue}.
 */
export function isUriValue(input: unknown): input is UriValue {
  // Only non-array objects can carry the named data properties required by the
  // URI value-object contract.
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return false;
  }

  // Read own descriptors without invoking accessors. Hostile Proxy descriptor
  // failures are contained as invalid boundary input.
  let kindDescriptor: PropertyDescriptor | undefined;
  let valueDescriptor: PropertyDescriptor | undefined;
  try {
    kindDescriptor = Object.getOwnPropertyDescriptor(input, "kind");
    valueDescriptor = Object.getOwnPropertyDescriptor(input, "value");
  } catch {
    return false;
  }

  // Require both own data fields, constrain the discriminator, and reject a
  // non-string URI payload before inspecting syntax.
  if (
    !kindDescriptor ||
    !("value" in kindDescriptor) ||
    !valueDescriptor ||
    !("value" in valueDescriptor) ||
    (kindDescriptor.value !== "absolute" && kindDescriptor.value !== "relative") ||
    typeof valueDescriptor.value !== "string"
  ) {
    return false;
  }

  // Enforce the ASCII URI surface, forbid platform path separators, validate
  // percent triplets, and allow at most one fragment delimiter.
  const value = valueDescriptor.value;
  if (
    !uriCharacters.test(value) ||
    value.includes("\\") ||
    invalidPercentEncoding.test(value) ||
    countOccurrences(value, "#") > 1
  ) {
    return false;
  }

  // Absolute values require a scheme. Relative values prohibit one and also
  // apply the first path-segment colon restriction.
  const hasAbsoluteScheme = absoluteScheme.test(value);
  if (kindDescriptor.value === "absolute") {
    return hasAbsoluteScheme;
  }

  return !hasAbsoluteScheme && !relativeFirstPathSegmentContainsColon(value);
}

/**
 * Detects the colon forbidden in the first segment of an RFC 3986 relative path.
 *
 * Network-path, absolute-path, query-only, and fragment-only references do not
 * have a first relative path segment requiring this check.
 *
 * @param value URI reference string with no absolute scheme.
 * @returns Whether the first relative path segment contains a colon.
 */
function relativeFirstPathSegmentContainsColon(value: string): boolean {
  // These reference forms do not use a path-noscheme first segment.
  if (value.startsWith("/") || value.startsWith("?") || value.startsWith("#")) {
    return false;
  }

  // Isolate path text before query or fragment data so later colons cannot be
  // mistaken for a path-segment violation.
  const queryIndex = value.indexOf("?");
  const fragmentIndex = value.indexOf("#");
  const pathEnd = [queryIndex, fragmentIndex]
    .filter((index) => index >= 0)
    .reduce((earliest, index) => Math.min(earliest, index), value.length);
  const path = value.slice(0, pathEnd);
  // Only the first slash-delimited segment is restricted; later segments may
  // contain colons under the generic URI grammar.
  const firstSegment = path.split("/", 1)[0] ?? "";
  return firstSegment.includes(":");
}

/**
 * Counts appearances of a delimiter without allocating a split array.
 *
 * @param value String to inspect.
 * @param delimiter Single-character delimiter to count.
 * @returns Number of delimiter appearances.
 */
function countOccurrences(value: string, delimiter: string): number {
  // Walk code points once and increment exact matches, avoiding the temporary
  // array allocation of a split-based count.
  let count = 0;
  for (const character of value) {
    if (character === delimiter) {
      count += 1;
    }
  }
  return count;
}
