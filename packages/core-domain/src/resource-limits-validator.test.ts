// Copyright © 2026 Mcont.

import { describe, expect, expectTypeOf, it, vi } from "vitest";

import {
  isInteractionResourceLimits,
  type InteractionResourceLimits,
} from "./interaction-resource-limits.js";
import type { ResolvedInteractionResourceLimits } from "./resolved-interaction-resource-limits.js";

describe("isInteractionResourceLimits", () => {
  // Exercise unresolved, resolved, numeric, reflective, and narrowing behavior
  // as one public validator contract.
  it("accepts an empty unresolved configuration layer", () => {
    const limits: unknown = {};

    // Absence means this layer supplies no override and must remain available to
    // the later field-by-field resolver.
    expect(isInteractionResourceLimits(limits)).toBe(true);
    if (!isInteractionResourceLimits(limits)) {
      throw new Error("Expected the empty resource-limit layer to be valid.");
    }

    // Successful validation narrows unknown input to the public optional type.
    const narrowed: InteractionResourceLimits = limits;
    expect(narrowed).toEqual({});
  });

  it("accepts each optional field independently at valid boundaries", () => {
    const validLimits = [
      { maxResponseBodyBytes: 1 },
      { maxStreamingErrorBodyBytes: Number.MAX_SAFE_INTEGER },
      { maxFrameBytes: 2_097_152 },
    ] as const;

    // Minimum and maximum exact positive integers are accepted without forcing
    // neighboring optional fields to be present.
    for (const limits of validLimits) {
      expect(isInteractionResourceLimits(limits)).toBe(true);
    }
  });

  it("accepts a complete resolved resource-limit value", () => {
    const limits: ResolvedInteractionResourceLimits = {
      maxResponseBodyBytes: 16_777_216,
      maxStreamingErrorBodyBytes: 1_048_576,
      maxFrameBytes: 2_097_152,
    };

    // The same semantic validator applies after resolution because all three
    // required fields use the identical positive byte-count rules.
    expect(isInteractionResourceLimits(limits)).toBe(true);
  });

  it.each([
    ["maxResponseBodyBytes", 0],
    ["maxStreamingErrorBodyBytes", -1],
    ["maxFrameBytes", -Number.MAX_SAFE_INTEGER],
  ] as const)("rejects the nonpositive %s value %s", (fieldName, invalidValue) => {
    // Zero and negatives cannot silently become unbounded or disabled resource
    // limits in downstream readers.
    expect(isInteractionResourceLimits({ [fieldName]: invalidValue })).toBe(false);
  });

  it.each([
    Number.MAX_SAFE_INTEGER + 1,
    2 ** 63,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    Number.NaN,
    1.5,
  ])("rejects the unsafe maxResponseBodyBytes value %s", (invalidValue) => {
    // Unsafe, non-finite, and fractional values cannot preserve an exact byte
    // count across JavaScript operations or supported language implementations.
    expect(isInteractionResourceLimits({ maxResponseBodyBytes: invalidValue })).toBe(false);
  });

  it.each(["1024", 1024n, true, null, { bytes: 1024 }, undefined])(
    "rejects the non-number maxFrameBytes value %s",
    (invalidValue) => {
      // No coercion or wrapper convention is part of the resource-limit boundary;
      // explicit undefined is presence, not an omitted optional field.
      expect(isInteractionResourceLimits({ maxFrameBytes: invalidValue })).toBe(false);
    },
  );

  it.each([undefined, null, true, 1, "limits", [], () => undefined])(
    "rejects the non-object resource-limit container %j",
    (invalidValue) => {
      // Only a named non-array object can carry independent limit fields.
      expect(isInteractionResourceLimits(invalidValue)).toBe(false);
    },
  );

  it("rejects a known accessor without invoking it", () => {
    const getter = vi.fn(() => 1024);
    const limits = Object.defineProperty({}, "maxResponseBodyBytes", {
      enumerable: true,
      get: getter,
    });

    // Descriptor inspection rejects executable configuration and prevents the
    // validation boundary from triggering application code.
    expect(isInteractionResourceLimits(limits)).toBe(false);
    expect(getter).not.toHaveBeenCalled();
  });

  it("preserves unknown structural fields without executing accessors", () => {
    const getter = vi.fn(() => "not inspected");
    const limits = Object.defineProperty({ maxResponseBodyBytes: 1024 }, "providerExtension", {
      enumerable: true,
      get: getter,
    });

    // Unknown properties remain outside this validator's control flow and do
    // not invalidate an otherwise valid structurally extensible object.
    expect(isInteractionResourceLimits(limits)).toBe(true);
    expect(getter).not.toHaveBeenCalled();
  });

  it("contains hostile and revoked Proxy failures", () => {
    const descriptorFailure = new Proxy(
      {},
      {
        ownKeys() {
          // Model reflection failure from an untrusted dynamic configuration.
          throw new Error("descriptor failure");
        },
      },
    );
    const { proxy: revokedProxy, revoke } = Proxy.revocable({}, {});
    revoke();

    // Reflection failures are invalid input rather than exceptions escaping the
    // public validation boundary.
    expect(isInteractionResourceLimits(descriptorFailure)).toBe(false);
    expect(isInteractionResourceLimits(revokedProxy)).toBe(false);
  });

  it("exposes the intended predicate signature", () => {
    // Lock the public unknown-input type guard so callers never need an unsafe
    // assertion before validating dynamic configuration.
    expectTypeOf(isInteractionResourceLimits).toEqualTypeOf<
      (value: unknown) => value is InteractionResourceLimits
    >();
  });
});
