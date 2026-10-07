// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import { DeterministicIdGenerator } from "./deterministic-id-generator.js";
import type { IdGenerator } from "./id-generator.js";

it("implements the minimal IdGenerator contract with a zero-argument constructor", () => {
  // The utility requires no seed or formatting configuration and remains usable
  // anywhere the shared nextId-only abstraction is accepted.
  expectTypeOf<DeterministicIdGenerator>().toMatchTypeOf<IdGenerator>();
  expectTypeOf<typeof DeterministicIdGenerator>().constructorParameters.toEqualTypeOf<[]>();
  expectTypeOf<DeterministicIdGenerator["nextId"]>().toEqualTypeOf<() => string>();
});

it("emits the fixed sequence from id-1", () => {
  const generator = new DeterministicIdGenerator();

  // Consecutive synchronous calls must produce an exact stable sequence so
  // snapshots and contract fixtures are repeatable across test runs.
  expect([generator.nextId(), generator.nextId(), generator.nextId()]).toEqual([
    "id-1",
    "id-2",
    "id-3",
  ]);
});

it("keeps sequence state isolated between generator instances", () => {
  const first = new DeterministicIdGenerator();
  const second = new DeterministicIdGenerator();

  // Advancing one instance cannot consume another fixture's IDs or introduce
  // test-order dependence through module-level state.
  expect(first.nextId()).toBe("id-1");
  expect(first.nextId()).toBe("id-2");
  expect(second.nextId()).toBe("id-1");
  expect(first.nextId()).toBe("id-3");
  expect(second.nextId()).toBe("id-2");
});

it("produces unique ordered values across a large synchronous batch", () => {
  const generator = new DeterministicIdGenerator();

  // Array.from invokes nextId sequentially in one JavaScript job, exercising the
  // same synchronous atomic update used when many fixtures allocate IDs quickly.
  const identifiers = Array.from({ length: 1_000 }, () => generator.nextId());

  expect(new Set(identifiers)).toHaveLength(1_000);
  expect(identifiers[0]).toBe("id-1");
  expect(identifiers[499]).toBe("id-500");
  expect(identifiers[999]).toBe("id-1000");
});

it("does not expose sequence state or control methods", () => {
  const generator = new DeterministicIdGenerator();

  // ECMAScript private storage prevents runtime reflection from discovering or
  // mutating the counter; only the prototype's nextId behavior is public.
  expect(Object.keys(generator)).toEqual([]);
  expect(Object.getOwnPropertySymbols(generator)).toEqual([]);
  expect("nextSequence" in generator).toBe(false);
  expect("reset" in generator).toBe(false);
  expect("peek" in generator).toBe(false);

  // Type-level checks keep the same minimal surface for TypeScript consumers.
  expectTypeOf<DeterministicIdGenerator>().not.toHaveProperty("nextSequence");
  expectTypeOf<DeterministicIdGenerator>().not.toHaveProperty("reset");
  expectTypeOf<DeterministicIdGenerator>().not.toHaveProperty("peek");
});
