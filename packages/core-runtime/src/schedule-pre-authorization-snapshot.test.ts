// Copyright © 2026 Mcont.

import type { TransportRequest } from "@evolutos/mconet-core-spi";
import { expect, it } from "vitest";

import { schedulePreAuthorizationSnapshot } from "./schedule-pre-authorization-snapshot.js";

const secretText = "snapshot-secret-value";

it("omits the secret and the encoded body", () => {
  const request: TransportRequest = {
    method: "POST",
    url: { kind: "absolute", value: `https://example.test/v1?key=${secretText}#${secretText}` },
    headers: [
      { name: "authorization", value: `Bearer ${secretText}` },
      { name: "content-type", value: "application/json" },
    ],
    query: [{ name: "key", value: secretText }],
    body: { kind: "bytes", bytes: new TextEncoder().encode(secretText) },
  };

  const snapshot = schedulePreAuthorizationSnapshot(request);

  expect(snapshot.bodyByteLength).toBe(secretText.length);
  expect(snapshot.queryCount).toBe(1);
  expect(JSON.stringify(snapshot)).not.toContain(secretText);
  expect(snapshot).not.toHaveProperty("body");
  expect(Object.isFrozen(snapshot)).toBe(true);
});
