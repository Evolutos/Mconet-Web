// Copyright © 2026 Mcont.

import { ModelInteractionError } from "@evolutos/mconet-core-domain";
import type { TransportRequest, TransportResponse } from "@evolutos/mconet-core-spi";
import { defineTransportContract } from "../../testing/src/transport-contract.js";

import type { BrowserFetch } from "./browser-fetch-transport-options.js";
import { BrowserFetchTransport } from "./browser-fetch-transport.js";

/** Bytes returned by a successful Chromium exchange. */
const successBytes = new Uint8Array([0x7b, 0x7d]);

/** Bytes that cross the oversized contract limit. */
const oversizedBytes = new Uint8Array([1, 2, 3, 4, 5]);

/**
 * Registers the shared Transport contract against the browser Fetch transport
 * running in Chromium.
 */
defineTransportContract("Chromium BrowserFetchTransport", () => {
  const request: TransportRequest = {
    method: "POST",
    url: { kind: "absolute", value: "https://service.example.test/models/run" },
    headers: [{ name: "content-type", value: "application/json" }],
    query: [],
    body: { kind: "bytes", bytes: new Uint8Array([0x7b, 0x7d]) },
  };
  const cancellationController = new AbortController();
  let successReleased = false;
  let serviceErrorReleased = false;
  let cancellationReleased = false;
  let oversizedReleased = false;

  return {
    successTransport: new BrowserFetchTransport({
      fetch: fetchResponse(successBytes, 200, "application/json", () => {
        successReleased = true;
      }),
    }),
    success: {
      request,
      context: { signal: new AbortController().signal, maxResponseBodyBytes: 16 },
      expected: response(successBytes, 200, "application/json", "application", "json"),
      isReleased: () => successReleased,
    },
    serviceErrorTransport: new BrowserFetchTransport({
      fetch: fetchResponse(successBytes, 429, "application/problem+json", () => {
        serviceErrorReleased = true;
      }),
    }),
    serviceError: {
      request,
      context: { signal: new AbortController().signal, maxResponseBodyBytes: 16 },
      expected: response(
        successBytes,
        429,
        "application/problem+json",
        "application",
        "problem+json",
      ),
      isReleased: () => serviceErrorReleased,
    },
    cancellationTransport: new BrowserFetchTransport({
      fetch: (_input, init) =>
        new Promise((_resolve, reject) => {
          const signal = init?.signal;
          if (signal === undefined) {
            reject(new Error("missing signal"));
            return;
          }
          const abort = (): void => {
            cancellationReleased = true;
            reject(signal.reason);
          };
          if (signal.aborted) {
            abort();
            return;
          }
          signal.addEventListener("abort", abort, { once: true });
        }),
    }),
    cancellation: {
      request,
      context: { signal: cancellationController.signal, maxResponseBodyBytes: 16 },
      abort: () => cancellationController.abort(new Error("contract-abort-reason")),
      expected: new ModelInteractionError({
        message: "The Fetch request was cancelled.",
        category: "cancelled",
        phase: "transport",
        code: "cancelled",
        diagnostics: [],
      }),
      isReleased: () => cancellationReleased,
    },
    oversizedTransport: new BrowserFetchTransport({
      fetch: fetchResponse(oversizedBytes, 200, "application/json", () => {
        oversizedReleased = true;
      }),
    }),
    oversized: {
      request,
      context: { signal: new AbortController().signal, maxResponseBodyBytes: 4 },
      observedResponseBodyBytes: oversizedBytes.byteLength,
      expected: new ModelInteractionError({
        message: "Response body exceeds its byte limit.",
        category: "invalid_request",
        phase: "transport",
        code: "response_body_too_large",
        diagnostics: [],
      }),
      isReleased: () => oversizedReleased,
    },
  };
});

/**
 * Builds a Fetch function whose response body reports when its reader is released.
 *
 * @param bytes Response bytes.
 * @param status HTTP status.
 * @param mediaType Content-Type value.
 * @param markReleased Called when the transport releases or cancels the reader.
 * @returns Fetch function for one contract case.
 */
function fetchResponse(
  bytes: Uint8Array,
  status: number,
  mediaType: string,
  markReleased: () => void,
): BrowserFetch {
  return () => Promise.resolve(trackedResponse(bytes, status, mediaType, markReleased));
}

/**
 * Builds a response whose reader reports release and cancellation.
 *
 * @param bytes Response bytes.
 * @param status HTTP status.
 * @param mediaType Content-Type value.
 * @param markReleased Called when the reader is released or cancelled.
 * @returns Platform response.
 */
function trackedResponse(
  bytes: Uint8Array,
  status: number,
  mediaType: string,
  markReleased: () => void,
): Response {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
  const getReader = stream.getReader.bind(stream);
  stream.getReader = () => {
    const reader = getReader();
    const releaseLock = reader.releaseLock.bind(reader);
    const cancel = reader.cancel.bind(reader);
    reader.releaseLock = () => {
      markReleased();
      releaseLock();
    };
    reader.cancel = (reason) => {
      markReleased();
      return cancel(reason);
    };
    return reader;
  };

  return new Response(stream, {
    status,
    headers: { "content-type": mediaType },
  });
}

/**
 * Builds the buffered response the contract compares after a completed exchange.
 *
 * @param bytes Expected body bytes.
 * @param status HTTP status.
 * @param contentType Visible Content-Type value.
 * @param type Parsed media type.
 * @param subtype Parsed media subtype.
 * @returns Transport response expected by the contract.
 */
function response(
  bytes: Uint8Array,
  status: number,
  contentType: string,
  type: string,
  subtype: string,
): TransportResponse {
  return {
    metadata: {
      outcome: status >= 200 && status <= 299 ? "success" : "service_error",
      statusCode: status,
      headers: [{ name: "content-type", value: contentType }],
      mediaType: { type, subtype, parameters: {} },
      extensions: {},
    },
    body: bytes,
  };
}
