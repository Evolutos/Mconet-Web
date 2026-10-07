// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type { Extensions, HeaderFields, MediaType } from "@evolutos/mconet-core-domain";

import type { TransportOutcome } from "./transport-outcome.js";
import type { TransportResponseMetadata } from "./transport-response-metadata.js";

it("defines only immutable response classification and metadata facts", () => {
  // Exact equality prevents response bytes, decoders, parsed service errors,
  // retry decisions, requests, or mutable transport state from entering metadata.
  expectTypeOf<TransportResponseMetadata>().toEqualTypeOf<{
    readonly outcome: TransportOutcome;
    readonly headers: HeaderFields;
    readonly statusCode?: number;
    readonly protocolStatusCode?: string;
    readonly trailers?: HeaderFields;
    readonly mediaType?: MediaType;
    readonly requestId?: string;
    readonly extensions: Extensions;
  }>();
});

it("preserves normalized and native response observations independently", () => {
  const headers = [
    { name: "set-cookie", value: "session=first" },
    { name: "set-cookie", value: "theme=dark" },
  ] as const satisfies HeaderFields;
  const trailers = [{ name: "x-checksum", value: "sha256:abc" }] as const satisfies HeaderFields;
  const mediaType: MediaType = {
    type: "application",
    subtype: "problem+json",
    parameters: { charset: "utf-8" },
  };
  const extensions: Extensions = {
    "transport.timing": { durationMs: 42 },
  };
  const metadata: TransportResponseMetadata = {
    outcome: "service_error",
    headers,
    statusCode: 429,
    protocolStatusCode: "rate_limited",
    trailers,
    mediaType,
    requestId: "request-1",
    extensions,
  };

  // Outcome and native statuses coexist without inference, while ordered field
  // collections and structured facts retain the exact supplied identities.
  expect(metadata.outcome).toBe("service_error");
  expect(metadata.statusCode).toBe(429);
  expect(metadata.protocolStatusCode).toBe("rate_limited");
  expect(metadata.headers).toBe(headers);
  expect(metadata.headers.map(({ value }) => value)).toEqual(["session=first", "theme=dark"]);
  expect(metadata.trailers).toBe(trailers);
  expect(metadata.mediaType).toBe(mediaType);
  expect(metadata.extensions).toBe(extensions);
});

it("keeps optional native response facts truly absent", () => {
  const metadata: TransportResponseMetadata = {
    outcome: "success",
    headers: [],
    extensions: {},
  };

  // A minimal response does not invent an HTTP status, textual protocol status,
  // trailers, content type, or request ID from the normalized success outcome.
  expect(metadata).toEqual({
    outcome: "success",
    headers: [],
    extensions: {},
  });
  expect(Object.hasOwn(metadata, "statusCode")).toBe(false);
  expect(Object.hasOwn(metadata, "mediaType")).toBe(false);
});

it("prevents response facts from being replaced after observation", () => {
  const proveReadonly = (
    metadata: TransportResponseMetadata,
    headers: HeaderFields,
    mediaType: MediaType,
  ): void => {
    // This compile-only helper locks representative required and optional facts
    // without mutating a runtime response fixture.
    // @ts-expect-error Outcome classification cannot be replaced.
    metadata.outcome = "transport_error";
    // @ts-expect-error Ordered response headers cannot be replaced.
    metadata.headers = headers;
    // @ts-expect-error Native status cannot be replaced.
    metadata.statusCode = 500;
    // @ts-expect-error Parsed media type cannot be replaced.
    metadata.mediaType = mediaType;
    // @ts-expect-error Extension membership cannot be replaced.
    metadata.extensions = {};
  };

  expectTypeOf(proveReadonly).toBeFunction();
});
