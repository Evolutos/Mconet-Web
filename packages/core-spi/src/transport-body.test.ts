// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type { BytesTransportBody } from "./bytes-transport-body.js";
import type { TransportBody } from "./transport-body.js";

it("contains exactly the implemented buffered-bytes branch", () => {
  // Exact equality prevents placeholder stream, multipart, text, null, or
  // unknown branches from being published before their lifecycles exist.
  expectTypeOf<TransportBody>().toEqualTypeOf<BytesTransportBody>();
});

it("narrows the current union through its stable discriminator", () => {
  const body: TransportBody = {
    kind: "bytes",
    bytes: new Uint8Array([1, 2]),
  };

  // The branch retains its concrete byte view after discriminator checking;
  // consumers need no cast, runtime wrapper, or fallback branch.
  if (body.kind === "bytes") {
    expect(body.bytes).toEqual(new Uint8Array([1, 2]));
    expectTypeOf(body).toEqualTypeOf<BytesTransportBody>();
  }
});

it("rejects unimplemented body representations", () => {
  // Compile-time exclusions keep unsupported lifecycles out of the public port
  // until concrete implementations and contract tests are ready.
  expectTypeOf<{
    readonly kind: "stream";
    readonly stream: unknown;
  }>().not.toMatchTypeOf<TransportBody>();
  expectTypeOf<{
    readonly kind: "multipart";
    readonly parts: readonly unknown[];
  }>().not.toMatchTypeOf<TransportBody>();
  expectTypeOf<string>().not.toMatchTypeOf<TransportBody>();
  expectTypeOf<null>().not.toMatchTypeOf<TransportBody>();
});
