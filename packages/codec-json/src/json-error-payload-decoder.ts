// Copyright © 2026 Mcont.

import type { OpenIdentifier } from "@evolutos/mconet-core-domain";
import type {
  CodecContext,
  ComponentDescriptor,
  ErasedRuntimeValue,
  PayloadDecoder,
} from "@evolutos/mconet-core-spi";

import { JsonSuccessPayloadDecoder } from "./json-success-payload-decoder.js";

/** Diagnostic component name. It is not a registry key or selection identity. */
const JSON_ERROR_DECODER_NAME = "json-error-payload-decoder";

/** Descriptive implementation version. It is not the package version. */
const JSON_ERROR_DECODER_VERSION = "1.0.0";

/**
 * Capability set required by the component descriptor.
 *
 * This decoder declares no capability yet. The set is shared and empty so
 * instances cannot grow independent capability claims.
 */
const decoderCapabilities: ReadonlySet<OpenIdentifier> = new Set();

/**
 * Decodes one bounded JSON error body without retaining a second copy.
 *
 * Error and success decoding share one JSON reader so a failure cannot grow a
 * parallel copy of the response bytes. This class is still a separate component
 * instance: callers select it before transport and it publishes its own
 * descriptor. It does not classify provider errors or attach the body to a failure.
 */
export class JsonErrorPayloadDecoder implements PayloadDecoder {
  /** Minimum descriptor required by the runtime component contract. */
  public readonly descriptor: ComponentDescriptor = {
    name: JSON_ERROR_DECODER_NAME,
    version: JSON_ERROR_DECODER_VERSION,
    capabilities: decoderCapabilities,
    source: "builtin",
  };

  /** JSON reader whose buffer policy this error decoder does not replace. */
  readonly #jsonDecoder: JsonSuccessPayloadDecoder;

  /**
   * Creates an error decoder that refuses bodies larger than `maxBodyBytes`.
   *
   * @param maxBodyBytes Maximum accepted UTF-8 body length as a positive safe integer.
   * @throws {ModelInteractionError} When `maxBodyBytes` cannot enforce a finite limit.
   */
  public constructor(maxBodyBytes: number) {
    // The inner reader owns the single bounded copy. This wrapper does not
    // buffer the bytes again before or after that read.
    this.#jsonDecoder = new JsonSuccessPayloadDecoder(maxBodyBytes);
  }

  /**
   * Decodes one complete error body into a JSON value.
   *
   * @param bytes Caller-owned response bytes.
   * @param context Cancellation signal for this codec operation.
   * @returns Erased JSON value. Provider error fields stay inside that value.
   * @throws {ModelInteractionError} When decoding is cancelled, the body is too large, or the text is not JSON.
   */
  public decode(bytes: Uint8Array, context: CodecContext): Promise<ErasedRuntimeValue> {
    return this.#jsonDecoder.decode(bytes, context);
  }
}
