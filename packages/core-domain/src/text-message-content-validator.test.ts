// Copyright © 2026 Mcont.

import { describe, expect, expectTypeOf, it, vi } from "vitest";

import { isTextMessageContent, type TextMessageContent } from "./text-message-content.js";

/** Creates a complete text value while allowing individual boundary overrides. */
function createTextContent(
  overrides: Readonly<Record<string, unknown>> = {},
): Record<string, unknown> {
  // Begin with every required field so each test override isolates one rule.
  return {
    id: "content-1",
    kind: "content.text",
    text: "Hello",
    metadata: {},
    extensions: {},
    ...overrides,
  };
}

describe("isTextMessageContent", () => {
  it.each(["", "你好世界", "wave 👋🏽 and smile 🙂", "first\nsecond\r\nthird", "e\u0301"])(
    "accepts and preserves the text %j",
    (text) => {
      const content = createTextContent({ text });

      // Validation recognizes empty, Unicode, emoji, multiline, and combining
      // sequences without trimming or normalizing the caller's string.
      expect(isTextMessageContent(content)).toBe(true);
      expect(content.text).toBe(text);
    },
  );

  it("narrows unknown input to TextMessageContent", () => {
    const candidate: unknown = createTextContent();

    // Guard before field access so TypeScript proves the public predicate has
    // the intended narrowing contract even with its optional length argument.
    if (!isTextMessageContent(candidate)) {
      throw new Error("Expected the fixture to satisfy TextMessageContent.");
    }
    expect(candidate.kind).toBe("content.text");
    expectTypeOf(isTextMessageContent).toEqualTypeOf<
      (value: unknown, maximumCodePoints?: number) => value is TextMessageContent
    >();
  });

  it("applies an inclusive Unicode code-point boundary", () => {
    const empty = createTextContent({ text: "" });
    const boundary = createTextContent({ text: "a🙂e\u0301" });
    const overBoundary = createTextContent({ text: "a🙂e\u0301!" });

    // The emoji is one code point and the combining accent is a separate point,
    // making the boundary string four positions rather than five UTF-16 units.
    expect([...String(boundary.text)]).toHaveLength(4);
    expect(isTextMessageContent(empty, 0)).toBe(true);
    expect(isTextMessageContent(boundary, 4)).toBe(true);
    expect(isTextMessageContent(overBoundary, 4)).toBe(false);
  });

  it("has no implicit domain-level text length limit", () => {
    const text = "文🙂".repeat(10_000);
    const content = createTextContent({ text });

    // Model context windows vary, so default validation preserves long text and
    // leaves a concrete limit to the caller or later integration policy.
    expect(isTextMessageContent(content)).toBe(true);
    expect([...text]).toHaveLength(20_000);
  });

  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1])(
    "rejects the invalid explicit code-point limit %s",
    (maximumCodePoints) => {
      // Invalid numeric policies fail closed instead of disabling the boundary.
      expect(isTextMessageContent(createTextContent(), maximumCodePoints)).toBe(false);
    },
  );

  it("rejects invalid non-number limits at a runtime boundary", () => {
    const invalidLimits: readonly unknown[] = [true, "4", null, {}];

    for (const invalidLimit of invalidLimits) {
      // The cast models plain JavaScript or deserialized configuration bypassing
      // TypeScript; runtime validation still rejects every non-number policy.
      expect(isTextMessageContent(createTextContent(), invalidLimit as number)).toBe(false);
    }
  });

  it.each([undefined, null, true, 1, "text", [], () => undefined])(
    "rejects the non-object content root %j",
    (candidate) => {
      // Text content must be a named record containing all shared fields.
      expect(isTextMessageContent(candidate)).toBe(false);
    },
  );

  it("requires own data properties for every declared field", () => {
    const inherited = Object.create(createTextContent()) as object;
    const textGetter = vi.fn(() => "hidden text");
    const accessorText = Object.defineProperty(createTextContent(), "text", {
      enumerable: true,
      get: textGetter,
    });

    for (const field of ["id", "kind", "text", "metadata", "extensions"] as const) {
      const incomplete = createTextContent();
      // Delete exactly one own field so each required descriptor is exercised
      // independently instead of substituting a present undefined value.
      expect(Reflect.deleteProperty(incomplete, field)).toBe(true);
      expect(isTextMessageContent(incomplete)).toBe(false);
    }

    // Inherited and accessor-backed fields also fail without executing the
    // valid-looking text getter.
    expect(isTextMessageContent(inherited)).toBe(false);
    expect(isTextMessageContent(accessorText)).toBe(false);
    expect(textGetter).not.toHaveBeenCalled();
  });

  it("rejects malformed identity, discriminator, and text values", () => {
    // Each scalar field retains its own invariant without coercion.
    expect(isTextMessageContent(createTextContent({ id: "content id" }))).toBe(false);
    expect(isTextMessageContent(createTextContent({ kind: "content.json" }))).toBe(false);
    expect(isTextMessageContent(createTextContent({ text: 1 }))).toBe(false);
  });

  it("rejects non-portable metadata and extensions", () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;

    // Shared JSON validation rejects non-record roots, unsupported values,
    // non-finite numbers, and cycles in both independent data channels.
    expect(isTextMessageContent(createTextContent({ metadata: [] }))).toBe(false);
    expect(isTextMessageContent(createTextContent({ metadata: { value: undefined } }))).toBe(false);
    expect(isTextMessageContent(createTextContent({ extensions: { value: Number.NaN } }))).toBe(
      false,
    );
    expect(isTextMessageContent(createTextContent({ extensions: cyclic }))).toBe(false);
  });

  it("allows unknown top-level fields without executing their getters", () => {
    const unknownGetter = vi.fn(() => "ignored");
    const content = Object.defineProperty(createTextContent(), "futureField", {
      enumerable: true,
      get: unknownGetter,
    });

    // Forward-compatible fields do not influence classification or cause side
    // effects while all known descriptors remain valid.
    expect(isTextMessageContent(content)).toBe(true);
    expect(unknownGetter).not.toHaveBeenCalled();
  });

  it("fails closed for a revoked proxy", () => {
    const { proxy, revoke } = Proxy.revocable(createTextContent(), {});
    revoke();

    // Reflection failures become a false predicate result rather than escaping
    // an exception through the public validation boundary.
    expect(() => isTextMessageContent(proxy)).not.toThrow();
    expect(isTextMessageContent(proxy)).toBe(false);
  });
});
