// Copyright © 2026 Mcont.

import { describe, expect, expectTypeOf, it } from "vitest";

import { isDuration, type Duration } from "./duration.js";

describe("Duration", () => {
  it("stores elapsed time in whole milliseconds", () => {
    const duration: Duration = { milliseconds: 1_500 };

    expectTypeOf<Duration>().toEqualTypeOf<{
      readonly milliseconds: number;
    }>();
    expect(duration).toEqual({ milliseconds: 1_500 });
  });

  it("represents zero duration explicitly", () => {
    const duration: Duration = { milliseconds: 0 };

    expect(duration.milliseconds).toBe(0);
  });

  it("rejects mutation at compile time", () => {
    const proveReadonly = (duration: Duration): void => {
      // @ts-expect-error Duration is an immutable value contract.
      duration.milliseconds = 1;
    };

    expectTypeOf(proveReadonly).toBeFunction();
  });

  it("does not accept ambiguous units or timestamp shapes", () => {
    expectTypeOf<number>().not.toMatchTypeOf<Duration>();
    expectTypeOf<{ readonly seconds: number }>().not.toMatchTypeOf<Duration>();
    expectTypeOf<{ readonly epochMilliseconds: number }>().not.toMatchTypeOf<Duration>();
  });

  describe("isDuration", () => {
    it.each([0, 1, 1_500, Number.MAX_SAFE_INTEGER])(
      "accepts the safe whole-millisecond value %s",
      (milliseconds) => {
        expect(isDuration({ milliseconds })).toBe(true);
      },
    );

    it("preserves forward-compatible additional fields", () => {
      expect(isDuration({ milliseconds: 1, futureField: "preserved" })).toBe(true);
    });

    it.each([
      undefined,
      null,
      0,
      "1",
      [],
      {},
      { milliseconds: "1" },
      { milliseconds: -1 },
      { milliseconds: -0 },
      { milliseconds: 0.5 },
      { milliseconds: Number.NaN },
      { milliseconds: Number.POSITIVE_INFINITY },
      { milliseconds: Number.NEGATIVE_INFINITY },
      { milliseconds: Number.MAX_SAFE_INTEGER + 1 },
    ])("rejects invalid duration input %j", (value) => {
      expect(isDuration(value)).toBe(false);
    });

    it("rejects an accessor without evaluating it", () => {
      let getterWasCalled = false;
      const value = Object.defineProperty({}, "milliseconds", {
        get: () => {
          getterWasCalled = true;
          return 1;
        },
      });

      expect(isDuration(value)).toBe(false);
      expect(getterWasCalled).toBe(false);
    });

    it("rejects a proxy whose property descriptor trap throws", () => {
      const value = new Proxy(
        {},
        {
          getOwnPropertyDescriptor: () => {
            throw new Error("untrusted proxy trap");
          },
        },
      );

      expect(isDuration(value)).toBe(false);
    });

    it("narrows a valid unknown value", () => {
      const value: unknown = { milliseconds: 250 };

      if (!isDuration(value)) {
        throw new Error("Expected a valid duration.");
      }

      const duration: Duration = value;
      expect(duration.milliseconds).toBe(250);
    });
  });
});
