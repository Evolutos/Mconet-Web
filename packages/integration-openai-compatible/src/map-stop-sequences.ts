// Copyright © 2026 Mcont.

import type { ProcessingResult } from "@evolutos/mconet-core-domain";

/** Stable code when stop sequences cannot be sent unchanged. */
const invalidStopSequencesCode = "invalid_stop_sequences";

/**
 * Stop sequences to place on a request, or an empty result when they are omitted.
 *
 * `stop` is absent when the caller did not set sequences. A present list keeps
 * the caller's order and text, including spaces and line breaks.
 */
export interface MappedStopSequences {
  /** Stop sequences to send, absent when the request should leave the service default. */
  readonly stop?: readonly string[];
}

/**
 * Maps ordered stop sequences onto the chat-completions `stop` field.
 *
 * An omitted list stays omitted. A non-empty list is copied in order and is not
 * trimmed, sorted, or joined into one string. An empty list is not omission:
 * sending it would be a different request, so it fails instead of being dropped.
 * An empty string inside the list fails for the same reason.
 *
 * @param stop Caller sequences, or `undefined` when the control was omitted.
 * @returns The request member, or an error diagnostic and no value.
 */
export function mapStopSequencesToWire(
  stop: readonly string[] | undefined,
): ProcessingResult<MappedStopSequences> {
  // Omission leaves the service default. It is not an empty stop list.
  if (stop === undefined) {
    return { value: Object.freeze({}), diagnostics: [] };
  }
  if (!isSendableStopSequences(stop)) {
    return {
      diagnostics: [
        {
          code: invalidStopSequencesCode,
          severity: "error",
          phase: "planning",
          message: "Stop sequences must be a non-empty list of non-empty strings.",
          path: "stop",
        },
      ],
    };
  }

  // Copy before freezing so a later edit of the caller's array cannot change
  // the sequences already planned.
  const copy: string[] = [];
  for (const sequence of stop) {
    copy.push(sequence);
  }
  return { value: Object.freeze({ stop: Object.freeze(copy) }), diagnostics: [] };
}

/**
 * Returns whether stop sequences can be written without dropping or rewriting one.
 *
 * @param stop Candidate sequence list.
 * @returns Whether the list is a non-empty array of non-empty strings.
 */
function isSendableStopSequences(stop: readonly string[]): boolean {
  if (!Array.isArray(stop) || stop.length === 0) {
    return false;
  }
  for (const sequence of stop) {
    // An empty string cannot mark a stopping point, and trimming would change
    // a sequence whose spaces or line breaks are intentional.
    if (typeof sequence !== "string" || sequence.length === 0) {
      return false;
    }
  }
  return true;
}
