// Copyright © 2026 Mcont.

import { describe, expect, expectTypeOf, it, vi } from "vitest";

import { SecretValue } from "./secret-value.js";

describe("SecretValue", () => {
  it("keeps plaintext out of ordinary object properties", () => {
    const secretValue = new SecretValue("test-credential");

    expect(Object.keys(secretValue)).toEqual([]);
    expect(Object.getOwnPropertyNames(secretValue)).toEqual([]);
    expect(Object.getOwnPropertySymbols(secretValue)).toEqual([]);
    expect({ ...secretValue }).toEqual({});
    expectTypeOf<SecretValue>().not.toMatchTypeOf<{
      readonly value: string;
    }>();
  });

  it("provides plaintext only to the explicit synchronous consumer", () => {
    const secretValue = new SecretValue("test-credential");
    const consumer = vi.fn((value: string) => value.length);

    const result = secretValue.expose(consumer);

    expect(result).toBe(15);
    expect(consumer).toHaveBeenCalledExactlyOnceWith("test-credential");
  });

  it("preserves the consumer result type", () => {
    const secretValue = new SecretValue("test-credential");
    const result = secretValue.expose((value) => ({ length: value.length }));

    expectTypeOf(result).toEqualTypeOf<{ length: number }>();
    expect(result).toEqual({ length: 15 });
  });

  it("propagates consumer failures without another invocation", () => {
    const failure = new Error("consumer failure");
    const consumer = vi.fn(() => {
      throw failure;
    });
    const secretValue = new SecretValue("test-credential");

    expect(() => secretValue.expose(consumer)).toThrow(failure);
    expect(consumer).toHaveBeenCalledTimes(1);
  });

  it("accepts only string constructor values at compile time", () => {
    expectTypeOf<ConstructorParameters<typeof SecretValue>>().toEqualTypeOf<[value: string]>();
    expectTypeOf<[value: number]>().not.toMatchTypeOf<ConstructorParameters<typeof SecretValue>>();
  });
});
