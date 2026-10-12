// Copyright © 2026 Mcont.

import type { HeaderField } from "@evolutos/mconet-core-domain";

import type { RawResponseSnapshot } from "./raw-response-snapshot.js";

/** Replacement used for every redacted header value and body secret. */
const redactedValue = "[REDACTED]";

/**
 * Header names whose values are credentials.
 *
 * Comparison is case-insensitive. Other headers stay intact, including names
 * that merely look similar.
 */
const sensitiveHeaderNames = new Set([
  "authorization",
  "proxy-authorization",
  "cookie",
  "set-cookie",
]);

/**
 * ASCII secret shapes aligned with the repository secret scan.
 *
 * The patterns describe shapes. They are not credentials. A match in a raw
 * body is replaced so the snapshot does not retain that text.
 */
const secretPatterns = [
  /\bAKIA[0-9A-Z]{16}\b/g,
  /-----BEGIN[ \t]+(?:RSA[ \t]+|EC[ \t]+|OPENSSH[ \t]+)?PRIVATE[ \t]+KEY-----/g,
  /\b(?:gh[pousr]_[A-Za-z0-9]{36,255}|github_pat_[A-Za-z0-9_]{60,255})\b/g,
  /\bsk-[A-Za-z0-9_-]{20,255}\b/g,
  /\bAIza[A-Za-z0-9_-]{35}\b/g,
  /\bxox[baprs]-[A-Za-z0-9-]{20,255}\b/g,
  /\beyJ[A-Za-z0-9_-]{7,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
];

/**
 * Returns a snapshot whose credential headers and secret-shaped body text are removed.
 *
 * The input snapshot is not modified. Header names remain. A sensitive header
 * value is replaced entirely. Body text is scanned as UTF-8 and only matching
 * spans are replaced. Metadata other than headers is copied by reference.
 *
 * @param snapshot Captured response before it is returned to the caller.
 * @returns A new snapshot safe to retain.
 */
export function redactRawResponse(snapshot: RawResponseSnapshot): RawResponseSnapshot {
  return {
    bytes: redactBody(snapshot.bytes),
    metadata: {
      ...snapshot.metadata,
      headers: snapshot.metadata.headers.map(redactHeader),
    },
  };
}

/**
 * Replaces one sensitive header value.
 *
 * @param header Original header occurrence.
 * @returns The same occurrence, or a new one with a redacted value.
 */
function redactHeader(header: HeaderField): HeaderField {
  if (!sensitiveHeaderNames.has(header.name.toLowerCase())) {
    return header;
  }
  return { name: header.name, value: redactedValue };
}

/**
 * Replaces secret-shaped UTF-8 spans in a response body.
 *
 * @param bytes Captured body bytes.
 * @returns The original bytes when nothing matches, otherwise a new encoding.
 */
function redactBody(bytes: Uint8Array): Uint8Array {
  const text = new TextDecoder().decode(bytes);
  let redacted = text;
  for (const pattern of secretPatterns) {
    pattern.lastIndex = 0;
    redacted = redacted.replace(pattern, redactedValue);
  }
  if (redacted === text) {
    return bytes;
  }
  return new TextEncoder().encode(redacted);
}
