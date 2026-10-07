// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type { Timestamp } from "@evolutos/mconet-core-domain";

import type { Clock } from "./clock.js";
import { FakeClock } from "./fake-clock.js";

it("implements Clock with one required initial Timestamp", () => {
  // Construction requires an explicit deterministic starting instant, while the
  // observation surface remains exactly compatible with Clock.
  expectTypeOf<FakeClock>().toMatchTypeOf<Clock>();
  expectTypeOf<typeof FakeClock>().constructorParameters.toEqualTypeOf<[Timestamp]>();
  expectTypeOf<FakeClock["now"]>().toEqualTypeOf<() => Timestamp>();
  expectTypeOf<FakeClock["advanceBy"]>().toEqualTypeOf<(milliseconds: number) => void>();
});

it("copies the initial value into a frozen stable snapshot", () => {
  const initialTime: Timestamp = { epochMilliseconds: -1_000 };
  const clock = new FakeClock(initialTime);
  const firstObservation = clock.now();

  // Clock ownership is shallow and explicit: the caller envelope stays untouched,
  // while repeated observations reuse the independently frozen clock snapshot.
  expect(firstObservation).toEqual({ epochMilliseconds: -1_000 });
  expect(firstObservation).not.toBe(initialTime);
  expect(Object.isFrozen(firstObservation)).toBe(true);
  expect(Object.isFrozen(initialTime)).toBe(false);
  expect(clock.now()).toBe(firstObservation);
});

it("advances by whole milliseconds and preserves prior observations", () => {
  const clock = new FakeClock({ epochMilliseconds: -500 });
  const beforeAdvance = clock.now();

  clock.advanceBy(750);

  const afterAdvance = clock.now();
  // Moving across the Unix epoch uses ordinary signed millisecond arithmetic;
  // the previous frozen observation cannot change behind its consumer.
  expect(beforeAdvance).toEqual({ epochMilliseconds: -500 });
  expect(afterAdvance).toEqual({ epochMilliseconds: 250 });
  expect(afterAdvance).not.toBe(beforeAdvance);
  expect(Object.isFrozen(afterAdvance)).toBe(true);
  expect(clock.now()).toBe(afterAdvance);
});

it("treats a zero advance as an allocation-free no-op", () => {
  const clock = new FakeClock({ epochMilliseconds: 5_000 });
  const beforeAdvance = clock.now();

  clock.advanceBy(0);

  // No elapsed virtual time means no new snapshot and no observable state change.
  expect(clock.now()).toBe(beforeAdvance);
  expect(clock.now().epochMilliseconds).toBe(5_000);
});

it.each([Number.NaN, Number.POSITIVE_INFINITY, 1.5, Number.MAX_SAFE_INTEGER + 1])(
  "rejects invalid initial epoch milliseconds %s",
  (epochMilliseconds) => {
    // Direct structural Timestamp construction can carry invalid runtime data;
    // FakeClock validates before publishing its first observation.
    expect(() => new FakeClock({ epochMilliseconds })).toThrow(RangeError);
  },
);

it.each([-1, Number.NaN, Number.POSITIVE_INFINITY, 0.5, Number.MAX_SAFE_INTEGER + 1])(
  "rejects invalid advance %s without changing time",
  (milliseconds) => {
    const clock = new FakeClock({ epochMilliseconds: 100 });
    const beforeAdvance = clock.now();

    expect(() => clock.advanceBy(milliseconds)).toThrow(RangeError);

    // Validation completes before assignment, preserving both value and identity
    // of the last valid snapshot after every rejected delta.
    expect(clock.now()).toBe(beforeAdvance);
    expect(clock.now().epochMilliseconds).toBe(100);
  },
);

it("rejects timestamp overflow without corrupting the current instant", () => {
  const clock = new FakeClock({ epochMilliseconds: Number.MAX_SAFE_INTEGER });
  const beforeAdvance = clock.now();

  expect(() => clock.advanceBy(1)).toThrow("exceeds the safe integer timestamp range");
  expect(clock.now()).toBe(beforeAdvance);
  expect(clock.now().epochMilliseconds).toBe(Number.MAX_SAFE_INTEGER);
});

it("keeps virtual time isolated between instances", () => {
  const first = new FakeClock({ epochMilliseconds: 1_000 });
  const second = new FakeClock({ epochMilliseconds: 1_000 });

  first.advanceBy(250);

  // No module-level time exists, so advancing one fixture cannot affect another.
  expect(first.now().epochMilliseconds).toBe(1_250);
  expect(second.now().epochMilliseconds).toBe(1_000);
  expect(first.now()).not.toBe(second.now());
});

it("does not expose arbitrary setting reset or timer behavior", () => {
  const clock = new FakeClock({ epochMilliseconds: 0 });

  // Runtime and type surfaces expose only observation plus forward advancement;
  // deadline scheduling remains a separate later harness.
  expect(Object.keys(clock)).toEqual([]);
  expect("set" in clock).toBe(false);
  expect("advanceTo" in clock).toBe(false);
  expect("reset" in clock).toBe(false);
  expect("setTimeout" in clock).toBe(false);
  expectTypeOf<FakeClock>().not.toHaveProperty("set");
  expectTypeOf<FakeClock>().not.toHaveProperty("advanceTo");
  expectTypeOf<FakeClock>().not.toHaveProperty("reset");
  expectTypeOf<FakeClock>().not.toHaveProperty("setTimeout");
});
