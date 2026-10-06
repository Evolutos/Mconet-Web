// Copyright © 2026 Mcont.

import { describe, expect, expectTypeOf, it } from "vitest";

import type { Duration } from "./duration.js";

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
});
