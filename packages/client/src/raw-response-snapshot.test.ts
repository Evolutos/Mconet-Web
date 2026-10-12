// Copyright © 2026 Mcont.

import type { TransportResponseMetadata } from "@evolutos/mconet-core-spi";
import { expect, expectTypeOf, it } from "vitest";

import type { RawResponseSnapshot } from "./raw-response-snapshot.js";

it("defines only readonly bytes and metadata", () => {
  expectTypeOf<RawResponseSnapshot>().toEqualTypeOf<{
    readonly bytes: Uint8Array;
    readonly metadata: TransportResponseMetadata;
  }>();
});

it("retains the supplied bytes and metadata", () => {
  const bytes = new Uint8Array([1, 2]);
  const metadata: TransportResponseMetadata = {
    outcome: "success",
    headers: [],
    extensions: {},
  };
  const snapshot: RawResponseSnapshot = { bytes, metadata };

  expect(snapshot.bytes).toBe(bytes);
  expect(snapshot.metadata).toBe(metadata);
});

it("prevents replacing captured bytes or metadata", () => {
  const proveReadonly = (
    snapshot: RawResponseSnapshot,
    bytes: Uint8Array,
    metadata: TransportResponseMetadata,
  ): void => {
    // @ts-expect-error Captured bytes cannot be replaced.
    snapshot.bytes = bytes;
    // @ts-expect-error Captured metadata cannot be replaced.
    snapshot.metadata = metadata;
  };

  expectTypeOf(proveReadonly).toBeFunction();
});
