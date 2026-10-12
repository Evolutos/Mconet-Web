// Copyright © 2026 Mcont.

import type { TransportResponseMetadata } from "@evolutos/mconet-core-spi";
import { expect, it } from "vitest";

import { redactRawResponse } from "./redact-raw-response.js";
import type { RawResponseSnapshot } from "./raw-response-snapshot.js";

it("removes credential headers and secret-shaped body text", () => {
  const secret = `sk-${"a".repeat(20)}`;
  const authorization = { name: "Authorization", value: "Bearer hidden" };
  const contentType = { name: "content-type", value: "application/json" };
  const snapshot: RawResponseSnapshot = {
    bytes: new TextEncoder().encode(`{"key":"${secret}"}`),
    metadata: metadata([authorization, contentType]),
  };

  const redacted = redactRawResponse(snapshot);

  expect(authorization.value).toBe("Bearer hidden");
  expect(redacted.metadata.headers[0]).toEqual({ name: "Authorization", value: "[REDACTED]" });
  expect(redacted.metadata.headers[1]).toBe(contentType);
  expect(new TextDecoder().decode(redacted.bytes)).toBe('{"key":"[REDACTED]"}');
  expect(new TextDecoder().decode(redacted.bytes)).not.toContain(secret);
});

function metadata(headers: TransportResponseMetadata["headers"]): TransportResponseMetadata {
  return { outcome: "success", headers, extensions: {} };
}
