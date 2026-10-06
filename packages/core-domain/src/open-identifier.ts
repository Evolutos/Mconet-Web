// Copyright © 2026 Mcont.

/**
 * Extensible identifier used where applications and integrations may introduce
 * names outside the SDK's built-in vocabulary.
 *
 * This alias intentionally preserves ordinary string assignability. Data from
 * JSON, URLs, storage, or the network still requires runtime validation at its
 * trust boundary; the type alone does not claim that validation has occurred.
 */
export type OpenIdentifier = string;

/** Maximum identifier length measured in Unicode code points. */
const maximumOpenIdentifierCodePoints = 128;

/** Whitespace and Unicode control, format, surrogate, private-use, or unassigned characters. */
const disallowedIdentifierCharacter = /[\s\p{C}]/u;

/**
 * Determines whether an unknown value is a well-formed open identifier.
 *
 * Identifiers remain Unicode-friendly and vocabulary-neutral. A period divides
 * namespace segments, so leading, trailing, or repeated periods are rejected.
 * The function does not trim or normalize input because doing so would silently
 * change identifier identity at a trust boundary.
 *
 * @param value Untrusted value to validate.
 * @returns Whether the value is a valid {@link OpenIdentifier}.
 */
export function isOpenIdentifier(value: unknown): value is OpenIdentifier {
  // Reject non-strings and the empty identity before applying string-specific
  // Unicode or namespace rules.
  if (typeof value !== "string" || value.length === 0) {
    return false;
  }

  // Count Unicode code points rather than UTF-16 code units so supplementary
  // characters consume one stable position across JavaScript runtimes.
  if ([...value].length > maximumOpenIdentifierCodePoints) {
    return false;
  }

  // Fail closed on whitespace and non-semantic Unicode categories without
  // normalizing the caller's identifier into a different value.
  if (disallowedIdentifierCharacter.test(value)) {
    return false;
  }

  // Periods delimit namespaces; every segment must therefore contain at least
  // one character, rejecting leading, trailing, and repeated delimiters.
  return value.split(".").every((segment) => segment.length > 0);
}
