// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type { IdGenerator } from "./id-generator.js";

it("exposes exactly one synchronous nextId method", () => {
  // Exact equality prevents seed, reset, peek, current-value, asynchronous, or
  // configuration concerns from entering the shared test abstraction.
  expectTypeOf<IdGenerator>().toEqualTypeOf<{
    nextId(): string;
  }>();
});

it("delegates each request to the concrete generator implementation", () => {
  let callCount = 0;
  const generator: IdGenerator = {
    nextId() {
      // Count calls inside this local fixture to prove the interface represents
      // an active next-value request rather than a stored identity property.
      callCount += 1;
      return `fixture-${callCount}`;
    },
  };

  expect(generator.nextId()).toBe("fixture-1");
  expect(generator.nextId()).toBe("fixture-2");
  expect(callCount).toBe(2);
});

it("requires a synchronous string result", () => {
  // A deterministic ID is consumed immediately by test event and fixture
  // builders; asynchronous and non-string results would add needless ordering.
  expectTypeOf<IdGenerator["nextId"]>().parameters.toEqualTypeOf<[]>();
  expectTypeOf<IdGenerator["nextId"]>().returns.toEqualTypeOf<string>();
  expectTypeOf<() => Promise<string>>().not.toMatchTypeOf<IdGenerator["nextId"]>();
  expectTypeOf<() => number>().not.toMatchTypeOf<IdGenerator["nextId"]>();
});

it("does not expose concrete sequence controls or state", () => {
  // Sequence mechanics remain private to later concrete utilities so contracts
  // can accept custom generators without depending on one implementation model.
  expectTypeOf<IdGenerator>().not.toHaveProperty("seed");
  expectTypeOf<IdGenerator>().not.toHaveProperty("prefix");
  expectTypeOf<IdGenerator>().not.toHaveProperty("currentId");
  expectTypeOf<IdGenerator>().not.toHaveProperty("reset");
  expectTypeOf<IdGenerator>().not.toHaveProperty("peek");
});
