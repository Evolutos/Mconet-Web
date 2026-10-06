// Copyright © 2026 Mcont.

import { describe, expect, expectTypeOf, it } from "vitest";

import { parseTimestamp, type Timestamp } from "./timestamp.js";

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

  describe("parseTimestamp", () => {
    it.each([
      ["1970-01-01T00:00:00Z", 0],
      ["2024-01-01T00:00:00.1Z", 1_704_067_200_100],
      ["2024-01-01T00:00:00.12Z", 1_704_067_200_120],
      ["2024-01-01T00:00:00.123Z", 1_704_067_200_123],
      ["2024-01-01T02:30:00.123+02:30", 1_704_067_200_123],
      ["2023-12-31T19:00:00.123-05:00", 1_704_067_200_123],
      ["1969-12-31T23:59:59.999Z", -1],
      ["2000-02-29T12:00:00Z", 951_825_600_000],
    ])("parses %s as UTC epoch milliseconds", (value, epochMilliseconds) => {
      expect(parseTimestamp(value)).toEqual({ epochMilliseconds });
    });

    it.each([
      undefined,
      null,
      0,
      {},
      "",
      "2024-01-01",
      "2024-01-01T00:00:00",
      "2024-01-01t00:00:00z",
      "0000-01-01T00:00:00Z",
      "2023-02-29T00:00:00Z",
      "2024-02-30T00:00:00Z",
      "2024-13-01T00:00:00Z",
      "2024-01-01T24:00:00Z",
      "2024-01-01T00:60:00Z",
      "2024-01-01T00:00:60Z",
      "2024-01-01T00:00:00.1234Z",
      "2024-01-01T00:00:00+24:00",
      "2024-01-01T00:00:00+01:60",
      "2024-01-01T00:00:00-00:00",
      "2024-01-01T00:00:00Z trailing",
    ])("rejects invalid timestamp input %j", (value) => {
      expect(parseTimestamp(value)).toBeUndefined();
    });
  });
});
