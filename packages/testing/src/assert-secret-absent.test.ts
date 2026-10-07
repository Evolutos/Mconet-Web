// Copyright © 2026 Mcont.

import { describe, expect, expectTypeOf, it, vi } from "vitest";

import { assertSecretAbsent } from "./assert-secret-absent.js";

/** Runtime-only plaintext assembled in memory to avoid committing a credential-like sample. */
const protectedPlaintext = ["runtime", "private", "marker"].join("-");

describe("assertSecretAbsent", () => {
  it("accepts clean header snapshot monitor error log and byte carriers", () => {
    const cleanCarriers = [
      [{ normalizedName: "authorization", value: "Bearer [REDACTED]" }],
      { endpoint: "https://service.invalid/models", authorization: "[REDACTED]" },
      { phase: "authorization", details: { credential: "[REDACTED]" } },
      new Error("Authorization failed for [REDACTED]"),
      ["request started", "authorization=[REDACTED]"],
      new TextEncoder().encode("body=[REDACTED]"),
    ];

    // One call covers the carrier categories required by later authorization and
    // monitoring security tests without converting objects through unsafe hooks.
    expect(() => assertSecretAbsent(protectedPlaintext, ...cleanCarriers)).not.toThrow();
  });

  it.each([
    ["header", [{ normalizedName: "authorization", value: `Bearer ${protectedPlaintext}` }]],
    ["snapshot", { endpoint: `https://service.invalid/?token=${protectedPlaintext}` }],
    ["monitor", { details: { credential: protectedPlaintext } }],
    ["error", new Error(`Authorization failed: ${protectedPlaintext}`)],
    ["error cause", new Error("Authorization failed", { cause: protectedPlaintext })],
    ["log", [`request credential=${protectedPlaintext}`]],
    ["bytes", new TextEncoder().encode(`body=${protectedPlaintext}`)],
  ])("detects plaintext in a %s carrier without echoing it", (_label, carrier) => {
    // Capture the assertion failure and verify its structural diagnostic contains
    // no copy of the plaintext it detected.
    expect.assertions(3);
    try {
      assertSecretAbsent(protectedPlaintext, carrier);
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toContain("Secret detected in an inspected carrier.");
      expect((error as Error).message).not.toContain(protectedPlaintext);
    }
  });

  it("inspects object keys symbols maps sets URLs and URL search parameters", () => {
    const secretNamedRecord = { [protectedPlaintext]: "redacted" };
    const secretSymbolRecord = { [Symbol(protectedPlaintext)]: "redacted" };
    const secretMap = new Map<unknown, unknown>([["credential", protectedPlaintext]]);
    const secretSet = new Set<unknown>([protectedPlaintext]);
    const secretUrl = new URL(
      `https://service.invalid/models?credential=${encodeURIComponent(protectedPlaintext)}`,
    );
    const secretParameters = new URLSearchParams({ credential: protectedPlaintext });

    // Every built-in carrier is inspected through data or a stable built-in
    // representation rather than generic string coercion.
    for (const carrier of [
      secretNamedRecord,
      secretSymbolRecord,
      secretMap,
      secretSet,
      secretUrl,
      secretParameters,
    ]) {
      expect(() => assertSecretAbsent(protectedPlaintext, carrier)).toThrow(
        "Secret detected in an inspected carrier.",
      );
    }
  });

  it("detects plaintext hidden by URL percent encoding", () => {
    const encodedPlaintext = ["reserved", "+/=?", "marker"].join("-");
    const pathUrl = new URL(`https://service.invalid/${encodeURIComponent(encodedPlaintext)}`);
    const searchParameters = new URLSearchParams({ credential: encodedPlaintext });

    // URL serialization percent-encodes reserved characters, but consumers can
    // recover the original value; decoded component and entry scans must detect it.
    expect(() => assertSecretAbsent(encodedPlaintext, pathUrl)).toThrow(
      "Secret detected in an inspected carrier.",
    );
    expect(() => assertSecretAbsent(encodedPlaintext, searchParameters)).toThrow(
      "Secret detected in an inspected carrier.",
    );
  });

  it("terminates on repeated and cyclic clean object references", () => {
    const shared = { value: "[REDACTED]" };
    const cyclic: { readonly shared: typeof shared; self?: unknown } = { shared };
    cyclic.self = cyclic;

    // Repeated references are scanned once and cycles terminate without treating
    // ordinary object identity as a leak or unsupported value.
    expect(() =>
      assertSecretAbsent(protectedPlaintext, { first: shared, second: shared, cyclic }),
    ).not.toThrow();
  });

  it("fails closed on accessors without invoking them", () => {
    const accessor = vi.fn(() => protectedPlaintext);
    const carrier = Object.create(null) as Record<string, unknown>;
    Object.defineProperty(carrier, "credential", {
      enumerable: true,
      get: accessor,
    });

    // Invoking arbitrary getters could cause side effects or return different
    // values across scans, so unsupported accessor data must fail immediately.
    expect(() => assertSecretAbsent(protectedPlaintext, carrier)).toThrow(
      "accessor-backed values are not inspectable",
    );
    expect(accessor).not.toHaveBeenCalled();
  });

  it("fails closed on class instances with hidden state", () => {
    const carrier = new Date(0);

    // A class instance may retain data in internal slots that own-property
    // traversal cannot observe, so accepting it would create a false negative.
    expect(() => assertSecretAbsent(protectedPlaintext, carrier)).toThrow(
      "object prototype is not a plain data container",
    );
  });

  it("does not retain a secret-bearing Proxy failure", () => {
    const carrier = new Proxy(Object.create(null) as Record<string, unknown>, {
      ownKeys: () => {
        throw new Error(protectedPlaintext);
      },
    });

    // Reflective failures are replaced with implementation-owned text and never
    // attached as cause, preventing the scanner from becoming a leak carrier.
    expect.assertions(3);
    try {
      assertSecretAbsent(protectedPlaintext, carrier);
    } catch (error) {
      expect(error).toBeInstanceOf(TypeError);
      expect((error as Error).message).not.toContain(protectedPlaintext);
      expect(Object.hasOwn(error as object, "cause")).toBe(false);
    }
  });

  it("rejects invalid or vacuous assertion input", () => {
    // An empty plaintext matches every string, while an empty carrier list proves
    // nothing; both forms indicate a broken security test rather than success.
    expect(() => assertSecretAbsent("", "safe")).toThrow(
      new TypeError("Secret must be a non-empty string."),
    );
    expect(() => assertSecretAbsent(protectedPlaintext)).toThrow(
      new TypeError("At least one carrier must be provided for secret scanning."),
    );
    // @ts-expect-error Runtime validation must reject untyped JavaScript input.
    expect(() => assertSecretAbsent(42, "safe")).toThrow(
      new TypeError("Secret must be a non-empty string."),
    );
  });

  it("exposes one variadic assertion contract", () => {
    // The function accepts heterogeneous carriers and communicates failure only
    // through exceptions, making successful use naturally return void.
    expectTypeOf(assertSecretAbsent).toEqualTypeOf<
      (secret: string, ...carriers: readonly unknown[]) => void
    >();
  });
});
