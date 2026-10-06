// Copyright © 2026 Mcont.

import { describe, expect, expectTypeOf, it } from "vitest";

import type { Timestamp } from "./timestamp.js";

describe("Timestamp", () => {
  it("stores a UTC instant at whole-millisecond precision", () => {
    const timestamp: Timestamp = { epochMilliseconds: 1_704_067_200_123 };

    expectTypeOf<Timestamp>().toEqualTypeOf<{
      readonly epochMilliseconds: number;
    }>();
    expect(timestamp).toEqual({ epochMilliseconds: 1_704_067_200_123 });
  });

  it("allows signed values so instants before the Unix epoch remain representable", () => {
    const timestamp: Timestamp = { epochMilliseconds: -1 };

    expect(timestamp.epochMilliseconds).toBe(-1);
  });

  it("rejects mutation at compile time", () => {
    const proveReadonly = (timestamp: Timestamp): void => {
      // @ts-expect-error Timestamp is an immutable value contract.
      timestamp.epochMilliseconds = 0;
    };

    expectTypeOf(proveReadonly).toBeFunction();
  });

  it("does not expose mutable or timezone-bearing platform objects", () => {
    expectTypeOf<Date>().not.toMatchTypeOf<Timestamp>();
    expectTypeOf<{ readonly epochSeconds: number }>().not.toMatchTypeOf<Timestamp>();
    expectTypeOf<{ readonly localDateTime: string }>().not.toMatchTypeOf<Timestamp>();
  });
});
