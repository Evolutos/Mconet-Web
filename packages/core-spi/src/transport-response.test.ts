// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type { Bytes } from "@evolutos/mconet-core-domain";

import type { TransportResponseMetadata } from "./transport-response-metadata.js";
import type { TransportResponse } from "./transport-response.js";

it("defines only response metadata and buffered bytes", () => {
  // Exact equality prevents requests, transport instances, decoded payloads,
  // service errors, retry state, or resource callbacks from entering the value.
  expectTypeOf<TransportResponse>().toEqualTypeOf<{
    readonly metadata: TransportResponseMetadata;
    readonly body: Bytes;
  }>();
});

it("preserves metadata and byte-view identity without decoding or copying", () => {
  const metadata: TransportResponseMetadata = {
    outcome: "success",
    headers: [],
    statusCode: 200,
    extensions: {},
  };
  const body: Bytes = new Uint8Array([123, 125]);
  const response: TransportResponse = { metadata, body };

  // Both identities cross the response boundary exactly as supplied; body
  // interpretation remains the responsibility of the preselected decoder.
  expect(response.metadata).toBe(metadata);
  expect(response.body).toBe(body);
  expect(response.body).toEqual(new Uint8Array([123, 125]));
});

it("represents a valid empty response body explicitly", () => {
  const response: TransportResponse = {
    metadata: {
      outcome: "service_error",
      headers: [],
      statusCode: 502,
      extensions: {},
    },
    body: new Uint8Array(),
  };

  // Zero bytes are distinct from an omitted body, null, stream, or decoded
  // value, so the unary byte contract remains structurally complete.
  expect(response.body.byteLength).toBe(0);
  expect(Object.hasOwn(response, "body")).toBe(true);
});

it("prevents response references from being replaced", () => {
  const proveReadonly = (
    response: TransportResponse,
    metadata: TransportResponseMetadata,
    body: Bytes,
  ): void => {
    // This compile-only helper locks the response envelope without claiming that
    // readonly reference syntax freezes caller-owned Uint8Array contents.
    // @ts-expect-error Response metadata cannot be replaced.
    response.metadata = metadata;
    // @ts-expect-error Response body view cannot be replaced.
    response.body = body;
  };

  expectTypeOf(proveReadonly).toBeFunction();
});
