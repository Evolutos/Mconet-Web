// Copyright © 2026 Mcont.

import type {
  Transport,
  TransportContext,
  TransportRequest,
  TransportResponse,
} from "@evolutos/mconet-core-spi";

import { RecordingTransport } from "./recording-transport.js";
import { defineTransportContract } from "./transport-contract.js";

/** Registers the shared suite against deterministic transport exchanges. */
defineTransportContract("RecordingTransport", () => {
  // Build fresh request and lifecycle state for every contract case so resource
  // probes and cancellation cannot leak across separately registered tests.
  const request: TransportRequest = {
    method: "POST",
    url: { kind: "absolute", value: "https://service.example.test/models/run" },
    headers: [{ name: "content-type", value: "application/json" }],
    query: [{ name: "mode", value: "contract" }],
    body: { kind: "bytes", bytes: new Uint8Array([0x7b, 0x7d]) },
  };
  const successContext: TransportContext = {
    signal: new AbortController().signal,
    maxResponseBodyBytes: 16,
  };
  const serviceErrorContext: TransportContext = {
    signal: new AbortController().signal,
    maxResponseBodyBytes: 16,
  };
  const cancellationController = new AbortController();
  const cancellationContext: TransportContext = {
    signal: cancellationController.signal,
    maxResponseBodyBytes: 16,
  };
  const oversizedContext: TransportContext = {
    signal: new AbortController().signal,
    maxResponseBodyBytes: 4,
  };
  const successResponse: TransportResponse = {
    metadata: {
      outcome: "success",
      statusCode: 200,
      headers: [{ name: "content-type", value: "application/json" }],
      extensions: {},
    },
    body: new Uint8Array([0x7b, 0x7d]),
  };
  const serviceErrorResponse: TransportResponse = {
    metadata: {
      outcome: "service_error",
      statusCode: 429,
      headers: [{ name: "content-type", value: "application/problem+json" }],
      extensions: {},
    },
    body: new Uint8Array([0x7b, 0x7d]),
  };
  const cancellationError = new Error("contract transport was cancelled");
  const oversizedError = new RangeError("contract response exceeds its byte limit");
  const descriptor: Transport["descriptor"] = {
    name: "contract-transport",
    version: "1.0.0",
    capabilities: new Set(),
    source: "application",
  };
  let successReleased = false;
  let serviceErrorReleased = false;
  let cancellationReleased = false;
  let oversizedReleased = false;

  const successTransport = new RecordingTransport({
    descriptor,
    send: () => {
      // Model cleanup before fulfillment so the suite observes no live resource
      // after the transport promise exposes its completely buffered response.
      successReleased = true;
      return Promise.resolve(successResponse);
    },
  });
  const serviceErrorTransport = new RecordingTransport({
    descriptor,
    send: () => {
      // A service-level response owns the same cleanup obligation as success;
      // protocol parsing remains outside the transport test double.
      serviceErrorReleased = true;
      return Promise.resolve(serviceErrorResponse);
    },
  });
  const cancellationTransport = new RecordingTransport({
    descriptor,
    send: (_request, context) =>
      new Promise<TransportResponse>((_resolve, reject) => {
        // Settle only when the exact supplied signal aborts, releasing the
        // simulated reader before propagating the normalized cancellation.
        const rejectOnAbort = (): void => {
          cancellationReleased = true;
          reject(cancellationError);
        };

        // Handle an already-aborted race while retaining the ordinary in-flight
        // event path exercised by the reusable contract suite.
        if (context.signal.aborted) {
          rejectOnAbort();
          return;
        }
        context.signal.addEventListener("abort", rejectOnAbort, { once: true });
      }),
  });
  const oversizedTransport = new RecordingTransport({
    descriptor,
    send: () => {
      // Simulate stopping an over-limit reader and releasing its source before
      // rejecting; no partial TransportResponse is manufactured.
      oversizedReleased = true;
      return Promise.reject(oversizedError);
    },
  });

  // Observation callbacks expose test-harness state only; transport resources
  // do not become part of the production Transport or TransportResponse SPI.
  return {
    successTransport,
    success: {
      request,
      context: successContext,
      expected: successResponse,
      isReleased: () => successReleased,
    },
    serviceErrorTransport,
    serviceError: {
      request,
      context: serviceErrorContext,
      expected: serviceErrorResponse,
      isReleased: () => serviceErrorReleased,
    },
    cancellationTransport,
    cancellation: {
      request,
      context: cancellationContext,
      abort: () => cancellationController.abort(cancellationError),
      expected: cancellationError,
      isReleased: () => cancellationReleased,
    },
    oversizedTransport,
    oversized: {
      request,
      context: oversizedContext,
      observedResponseBodyBytes: 5,
      expected: oversizedError,
      isReleased: () => oversizedReleased,
    },
  };
});
