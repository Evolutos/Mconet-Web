// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type { Timestamp } from "@evolutos/mconet-core-domain";

import type { Clock } from "./clock.js";

it("exposes exactly one synchronous current-time method", () => {
  // Exact equality prevents timer creation, sleeping, mutation controls, zones,
  // or platform Date objects from entering the shared observation abstraction.
  expectTypeOf<Clock>().toEqualTypeOf<{
    now(): Timestamp;
  }>();
});

it("delegates every observation to the concrete clock", () => {
  const first: Timestamp = { epochMilliseconds: 1_000 };
  const second: Timestamp = { epochMilliseconds: 2_000 };
  const observations = [first, second] as const;
  let observationIndex = 0;
  const clock: Clock = {
    now() {
      // Select the next local fixture value and advance only fixture-owned state;
      // the interface itself defines no progression or mutation behavior.
      const timestamp = observations[observationIndex];
      if (timestamp === undefined) {
        throw new Error("Clock fixture has no remaining observation.");
      }
      observationIndex += 1;
      return timestamp;
    },
  };

  expect(clock.now()).toBe(first);
  expect(clock.now()).toBe(second);
  expect(observationIndex).toBe(2);
});

it("requires a synchronous portable Timestamp result", () => {
  // Shared epoch-millisecond values cross browser and Node test boundaries
  // without exposing mutable or timezone-sensitive platform objects.
  expectTypeOf<Clock["now"]>().parameters.toEqualTypeOf<[]>();
  expectTypeOf<Clock["now"]>().returns.toEqualTypeOf<Timestamp>();
  expectTypeOf<() => Date>().not.toMatchTypeOf<Clock["now"]>();
  expectTypeOf<() => number>().not.toMatchTypeOf<Clock["now"]>();
  expectTypeOf<() => Promise<Timestamp>>().not.toMatchTypeOf<Clock["now"]>();
});

it("does not expose concrete time controls or timer behavior", () => {
  // Advancement and mutation belong to the later FakeClock utility, while timer
  // scheduling remains outside the observation-only Clock contract entirely.
  expectTypeOf<Clock>().not.toHaveProperty("set");
  expectTypeOf<Clock>().not.toHaveProperty("advance");
  expectTypeOf<Clock>().not.toHaveProperty("sleep");
  expectTypeOf<Clock>().not.toHaveProperty("setTimeout");
  expectTypeOf<Clock>().not.toHaveProperty("epochMilliseconds");
});
