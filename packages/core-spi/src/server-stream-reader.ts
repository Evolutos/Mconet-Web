// Copyright © 2026 Mcont.

import type { ErasedRuntimeValue } from "./erased-runtime-value.js";
import type { RuntimeComponent } from "./runtime-component.js";

/**
 * Controls for reading one server-sent text response.
 *
 * The frames are the encoded body in arrival order. `onText` receives each
 * newly decoded text fragment and must not retain the reader. Limits are the
 * resolved interaction ceilings.
 */
export interface ServerStreamReadInput {
  /** Encoded response frames in arrival order. */
  readonly frames: AsyncIterable<Uint8Array>;

  /** Cancellation signal for this read. */
  readonly signal: AbortSignal;

  /** Maximum encoded body bytes, including every frame. */
  readonly maxBodyBytes: number;

  /** Maximum encoded bytes accepted for one SSE event. */
  readonly maxFrameBytes: number;

  /** Optional observer for each new text fragment. */
  readonly onText?: (text: string) => void;
}

/**
 * Replaceable reader for one server-stream text response.
 *
 * The reader turns provider frames into the success payload the protocol
 * adapter already parses. It does not authorize, choose a transport, or
 * assemble a model output.
 */
export interface ServerStreamReader extends RuntimeComponent {
  /**
   * Reads one response body and returns the adapter's success payload.
   *
   * @param input Frames, limits, cancellation, and the optional text observer.
   * @returns The decoded success value, including its protocol type id.
   */
  read(input: ServerStreamReadInput): Promise<ErasedRuntimeValue>;
}
