// Copyright © 2026 Mcont.

import type { Bytes } from "@evolutos/mconet-core-domain";

/**
 * Host encoder shape used to produce UTF-8 bytes.
 *
 * The structural contract avoids depending on DOM or Node ambient types while
 * still requiring the standard `encode` operation. It carries no JSON, media
 * type, or payload knowledge.
 */
interface HostUtf8Encoder {
  /** Encodes one JavaScript string into a new UTF-8 byte array. */
  encode(input?: string): Uint8Array;
}

/**
 * Host constructor shape for the platform UTF-8 encoder.
 *
 * Only the construct signature is required. Options, streaming, and decoder
 * behavior stay outside this JSON codec primitive.
 */
interface HostUtf8EncoderConstructor {
  /** Creates one stateless UTF-8 encoder. */
  new (): HostUtf8Encoder;
}

/**
 * Encodes one JavaScript string as UTF-8 bytes.
 *
 * The wrapper delegates to the host `TextEncoder`, so supplementary-plane
 * scalars and emoji use the platform's UTF-8 mapping in browsers, workers, and
 * Node.js. Lone surrogates follow that host replacement policy instead of a
 * second codec-specific Unicode rule. The function does not serialize JSON,
 * inspect payloads, or retain the input. Each call returns a new byte array
 * owned by the caller.
 *
 * @param text JavaScript string to encode. An empty string is valid input.
 * @returns Newly allocated UTF-8 bytes for `text`.
 * @throws {Error} When this runtime does not provide `TextEncoder`.
 */
export function encodeUtf8(text: string): Bytes {
  // Construct per call. TextEncoder is stateless, and a fresh instance cannot
  // retain text from a previous caller.
  return createHostUtf8Encoder().encode(text);
}

/**
 * Creates the platform UTF-8 encoder from the current global object.
 *
 * Browsers, workers, and Node.js 20 expose the same constructor. Reading it
 * from `globalThis` keeps this package on the pure-core type surface.
 *
 * @returns Host encoder whose `encode` result is a new byte array.
 * @throws {Error} When `TextEncoder` is absent.
 */
function createHostUtf8Encoder(): HostUtf8Encoder {
  const host = globalThis as { readonly TextEncoder?: HostUtf8EncoderConstructor };
  const TextEncoder = host.TextEncoder;

  // Fail before encoding so a missing host primitive cannot be mistaken for an
  // empty byte result.
  if (TextEncoder === undefined) {
    throw new Error("UTF-8 text encoding is not available in this runtime.");
  }

  return new TextEncoder();
}
