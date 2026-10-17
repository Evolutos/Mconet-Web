// Copyright © 2026 Mcont.

import type { TransportContext } from "./transport-context.js";
import type { TransportRequest } from "./transport-request.js";
import type { TransportResponseMetadata } from "./transport-response-metadata.js";

/**
 * Response whose body stays a frame sequence.
 *
 * Metadata matches a buffered transport response. The body is not concatenated
 * by the transport.
 */
export interface StreamingTransportResponse {
  /** Protocol-neutral response facts available before the body is consumed. */
  readonly metadata: TransportResponseMetadata;

  /** Response frames in arrival order. */
  readonly body: AsyncIterable<Uint8Array>;
}

/**
 * Transport that can expose a response body as frames.
 *
 * Unary `send` remains the buffered exchange. `open` is the text server-stream
 * path. A transport without `open` can still serve that path: the runtime
 * buffers `send` and supplies the bytes as one frame.
 */
export interface StreamingByteTransport {
  /**
   * Sends one encoded request and returns the response body as frames.
   *
   * @param request Encoded transport request.
   * @param context Cancellation, deadline, and the response byte limit.
   * @returns Response metadata and the unread body.
   */
  open(request: TransportRequest, context: TransportContext): Promise<StreamingTransportResponse>;
}
