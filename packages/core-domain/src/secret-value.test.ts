// Copyright © 2026 Mcont.

import { describe, expect, expectTypeOf, it, vi } from "vitest";
import { inspect } from "node:util";

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

  it("redacts explicit and implicit string representations", () => {
    const plaintext = "test-credential";
    const secretValue = new SecretValue(plaintext);

    const representations = [
      secretValue.toString(),
      String(secretValue),
      `${secretValue}`,
      `credential=${secretValue}`,
    ];

    expect(representations).toEqual([
      "[REDACTED]",
      "[REDACTED]",
      "[REDACTED]",
      "credential=[REDACTED]",
    ]);
    expect(representations.every((value) => !value.includes(plaintext))).toBe(true);
  });

  it("redacts direct and nested JSON serialization", () => {
    const plaintext = "test-credential";
    const secretValue = new SecretValue(plaintext);

    const directJson = JSON.stringify(secretValue);
    const nestedJson = JSON.stringify({ credential: secretValue });

    expect(directJson).toBe('"[REDACTED]"');
    expect(nestedJson).toBe('{"credential":"[REDACTED]"}');
    expect(directJson).not.toContain(plaintext);
    expect(nestedJson).not.toContain(plaintext);
  });

  it("redacts direct and nested Node inspection", () => {
    const plaintext = "test-credential";
    const secretValue = new SecretValue(plaintext);

    const directInspection = inspect(secretValue);
    const nestedInspection = inspect({ credential: secretValue });

    expect(directInspection).toBe("[REDACTED]");
    expect(nestedInspection).toContain("[REDACTED]");
    expect(directInspection).not.toContain(plaintext);
    expect(nestedInspection).not.toContain(plaintext);
  });

  it("keeps plaintext out of interpolated errors", () => {
    const plaintext = "test-credential";
    const secretValue = new SecretValue(plaintext);

    const failure = new Error(`Authorization failed for ${secretValue}`);
    const inspectedFailure = inspect(failure);

    expect(failure.message).toBe("Authorization failed for [REDACTED]");
    expect(failure.message).not.toContain(plaintext);
    expect(inspectedFailure).not.toContain(plaintext);
  });
});
