// Copyright © 2026 Mcont.

import { describe, expect, expectTypeOf, it } from "vitest";

import type { Bytes } from "./bytes.js";

describe("Bytes", () => {
  it("is exactly the runtime-neutral Uint8Array shape", () => {
    expectTypeOf<Bytes>().toEqualTypeOf<Uint8Array>();
    expectTypeOf<ArrayBuffer>().not.toMatchTypeOf<Bytes>();
    expectTypeOf<readonly number[]>().not.toMatchTypeOf<Bytes>();
  });

  it("preserves typed-array byte values", () => {
    const bytes: Bytes = new Uint8Array([0, 127, 255]);

    expect([...bytes]).toEqual([0, 127, 255]);
  });
});
