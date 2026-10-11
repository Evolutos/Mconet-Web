// Copyright © 2026 Mcont.

import { parseMediaType, type HeaderFields, type MediaType } from "@evolutos/mconet-core-domain";

/** Response header that carries the representation media type. */
const CONTENT_TYPE_HEADER_NAME = "content-type";

/**
 * Reads the response media type from ordered header occurrences.
 *
 * Exactly one `Content-Type` header is parsed. A missing header stays absent,
 * and so does a repeated header: the mapper does not choose one value or join
 * the values into a type the response did not send. An unparsable single value
 * is also absent. Header name comparison is case-insensitive. This function
 * does not read the body or invent `application/json`.
 *
 * @param headers Ordered response header occurrences visible to the caller.
 * @returns The parsed media type, or `undefined` when it is missing or ambiguous.
 */
export function mapFetchResponseMediaType(headers: HeaderFields): MediaType | undefined {
  if (!Array.isArray(headers)) {
    return undefined;
  }

  let contentTypeValue: string | undefined;
  let contentTypeCount = 0;

  for (let index = 0; index < headers.length; index += 1) {
    if (!Object.hasOwn(headers, index)) {
      continue;
    }

    const header = headers[index];
    if (
      header === undefined ||
      typeof header.name !== "string" ||
      typeof header.value !== "string" ||
      header.name.toLowerCase() !== CONTENT_TYPE_HEADER_NAME
    ) {
      continue;
    }

    contentTypeCount += 1;
    contentTypeValue = header.value;
  }

  // Zero occurrences and repeated occurrences are both "not explicitly available".
  if (contentTypeCount !== 1 || contentTypeValue === undefined) {
    return undefined;
  }

  return parseMediaType(contentTypeValue);
}
