// Copyright © 2026 Mcont.

import { parseMediaType } from "@evolutos/mconet-core-domain";

/** Subtype that means the body is JSON without a structured suffix. */
const JSON_SUBTYPE = "json";

/** Structured syntax suffix for a JSON representation of another subtype. */
const JSON_STRUCTURED_SUFFIX = "+json";

/**
 * Determines whether one media type value is JSON or a JSON structured suffix.
 *
 * Parsing and case normalization come from the shared media-type parser.
 * Parameters such as charset do not change the JSON decision. A suffix matches
 * only when a non-empty subtype prefix precedes `+json`, so `+json` alone is
 * not a media type this codec accepts. The function does not read a body or
 * select a decoder.
 *
 * @param value Untrusted media type string or any other runtime value.
 * @returns Whether the value is a valid JSON or `+json` media type.
 */
export function isJsonMediaType(value: unknown): boolean {
  const mediaType = parseMediaType(value);
  // An unparsable value is not JSON, including non-strings and malformed types.
  if (mediaType === undefined) {
    return false;
  }
  if (mediaType.subtype === JSON_SUBTYPE) {
    return true;
  }
  return (
    mediaType.subtype.endsWith(JSON_STRUCTURED_SUFFIX) &&
    mediaType.subtype.length > JSON_STRUCTURED_SUFFIX.length
  );
}
