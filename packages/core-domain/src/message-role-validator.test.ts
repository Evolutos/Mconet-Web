// Copyright © 2026 Mcont.

import { describe, expect, expectTypeOf, it, vi } from "vitest";

import { isMessageRole, type MessageRole } from "./message-role.js";

describe("isMessageRole", () => {
  it.each([
    "message.system",
    "message.developer",
    "message.user",
    "message.assistant",
    "message.tool",
  ])("accepts the standard role %s", (id) => {
    // Every standard identity follows the same open contract and needs no
    // special-case behavior in this representation validator.
    expect(isMessageRole({ id, extensions: {} })).toBe(true);
  });

  it("accepts an integration-defined complete role", () => {
    const role = {
      id: "provider.review_observer",
      semantic: "observer",
      rawValue: "review-observer-v2",
      extensions: {
        "provider.role": { priority: 2, enabled: false },
      },
    };

    // Open identity, optional source details, and namespaced JSON extensions are
    // preserved without coercion to a standard role.
    expect(isMessageRole(role)).toBe(true);
  });

  it("narrows unknown input to MessageRole", () => {
    const candidate: unknown = { id: "message.user", extensions: {} };

    // Use the guard result before accessing fields so TypeScript proves the
    // public predicate exposes the intended narrowing signature.
    expect(isMessageRole(candidate)).toBe(true);
    if (!isMessageRole(candidate)) {
      throw new Error("Expected the fixture to satisfy MessageRole.");
    }
    expect(candidate.id).toBe("message.user");
    expectTypeOf(isMessageRole).toEqualTypeOf<(value: unknown) => value is MessageRole>();
  });

  it("rejects non-object and array roots", () => {
    const candidates: readonly unknown[] = [
      undefined,
      null,
      false,
      0,
      "message.user",
      [],
      () => null,
    ];

    // A role is a named record, never a primitive, callable, or ordered list.
    for (const candidate of candidates) {
      expect(isMessageRole(candidate)).toBe(false);
    }
  });

  it("requires own data properties for id and extensions", () => {
    const inherited = Object.create({ id: "message.user", extensions: {} }) as object;
    const idGetter = vi.fn(() => "message.user");
    const accessorId = Object.defineProperty({ extensions: {} }, "id", {
      enumerable: true,
      get: idGetter,
    });

    // Missing, inherited, and accessor-backed required fields fail without
    // executing the valid-looking getter.
    expect(isMessageRole({ id: "message.user" })).toBe(false);
    expect(isMessageRole({ extensions: {} })).toBe(false);
    expect(isMessageRole(inherited)).toBe(false);
    expect(isMessageRole(accessorId)).toBe(false);
    expect(idGetter).not.toHaveBeenCalled();
  });

  it.each(["", "message user", ".message", "message.", "message..user"])(
    "rejects the invalid open identifier %j",
    (id) => {
      // Identifier validation is delegated to the shared syntax boundary.
      expect(isMessageRole({ id, extensions: {} })).toBe(false);
    },
  );

  it("enforces exact optional string semantics without invoking accessors", () => {
    const semanticGetter = vi.fn(() => "user");
    const accessorSemantic = Object.defineProperty(
      { id: "message.user", extensions: {} },
      "semantic",
      { enumerable: true, get: semanticGetter },
    );

    // True absence and strings are valid; explicit undefined, other types, and
    // accessor-produced strings are not valid optional properties.
    expect(isMessageRole({ id: "message.user", extensions: {} })).toBe(true);
    expect(isMessageRole({ id: "message.user", semantic: "user", extensions: {} })).toBe(true);
    expect(isMessageRole({ id: "message.user", rawValue: "human", extensions: {} })).toBe(true);
    expect(isMessageRole({ id: "message.user", semantic: undefined, extensions: {} })).toBe(false);
    expect(isMessageRole({ id: "message.user", rawValue: 1, extensions: {} })).toBe(false);
    expect(isMessageRole(accessorSemantic)).toBe(false);
    expect(semanticGetter).not.toHaveBeenCalled();
  });

  it("rejects non-JSON cyclic and non-finite extensions", () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;

    // The shared JSON-record validator rejects non-record roots, unsupported
    // values, non-finite numbers, and cycles without serializing the input.
    expect(isMessageRole({ id: "message.user", extensions: [] })).toBe(false);
    expect(isMessageRole({ id: "message.user", extensions: { value: undefined } })).toBe(false);
    expect(isMessageRole({ id: "message.user", extensions: { value: Number.NaN } })).toBe(false);
    expect(isMessageRole({ id: "message.user", extensions: cyclic })).toBe(false);
  });

  it("allows unknown top-level fields without executing their getters", () => {
    const unknownGetter = vi.fn(() => "ignored");
    const role = Object.defineProperty(
      { id: "provider.future_role", extensions: {} },
      "futureField",
      { enumerable: true, get: unknownGetter },
    );

    // Structural forward compatibility ignores unknown descriptors while known
    // field validation remains side-effect free.
    expect(isMessageRole(role)).toBe(true);
    expect(unknownGetter).not.toHaveBeenCalled();
  });

  it("fails closed for a revoked proxy", () => {
    const { proxy, revoke } = Proxy.revocable({ id: "message.user", extensions: {} }, {});
    revoke();

    // Reflection failures are reported as invalid input instead of escaping an
    // exception through the public trust-boundary predicate.
    expect(() => isMessageRole(proxy)).not.toThrow();
    expect(isMessageRole(proxy)).toBe(false);
  });
});
