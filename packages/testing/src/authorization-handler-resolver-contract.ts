// Copyright © 2026 Mcont.

import { describe, expect, it } from "vitest";

import type { AuthorizationHandlerResolver } from "@evolutos/mconet-core-spi";

/** Complete reusable fixture required by the AuthorizationHandlerResolver contract suite. */
export interface AuthorizationHandlerResolverContractFixture {
  /** Fresh resolver used by one isolated contract case. */
  readonly resolver: AuthorizationHandlerResolver;
  /** Input with one compatible handler and its exact expected instance. */
  readonly one: Readonly<{
    input: Parameters<AuthorizationHandlerResolver["resolve"]>[0];
    expected: ReturnType<AuthorizationHandlerResolver["resolve"]>;
  }>;
  /** Input with no compatible handlers and its deterministic error. */
  readonly none: Readonly<{
    input: Parameters<AuthorizationHandlerResolver["resolve"]>[0];
    expected: Error;
  }>;
  /** Input with multiple compatible handlers and its deterministic error. */
  readonly many: Readonly<{
    input: Parameters<AuthorizationHandlerResolver["resolve"]>[0];
    expected: Error;
  }>;
}

/**
 * Registers the reusable behavioral contract for one AuthorizationHandlerResolver.
 *
 * @param name Stable implementation name shown in contract test reports.
 * @param createFixture Factory returning isolated none, one, and many fixtures.
 */
export function defineAuthorizationHandlerResolverContract(
  name: string,
  createFixture: () => AuthorizationHandlerResolverContractFixture,
): void {
  // Create a new resolver and candidate collection per case so support checks or
  // resolver state cannot cross the none, one, and many selection boundaries.
  describe(`${name} AuthorizationHandlerResolver contract`, () => {
    it("returns the exact configured handler when one candidate matches", () => {
      const { one, resolver } = createFixture();
      const authorizationSnapshot = structuredClone(one.input.authorization);
      const handlersSnapshot = [...one.input.handlers];
      const matches = one.input.handlers.filter((handler) =>
        handler.supports(one.input.authorization),
      );

      // Fixture validation proves there is exactly one semantic match before the
      // resolver is required to return that configured instance by identity.
      expect(matches).toHaveLength(1);
      expect(matches[0]).toBe(one.expected);
      expect(one.input.handlers).toContain(one.expected);
      expect(resolver.resolve(one.input)).toBe(one.expected);
      expect(resolver.resolve(one.input)).toBe(one.expected);
      expect(one.input.authorization).toEqual(authorizationSnapshot);
      expect(one.input.handlers).toEqual(handlersSnapshot);
    });

    it("throws the deterministic no-match error without mutating candidates", () => {
      const { many, none, resolver } = createFixture();
      const authorizationSnapshot = structuredClone(none.input.authorization);
      const handlersSnapshot = [...none.input.handlers];
      const matches = none.input.handlers.filter((handler) =>
        handler.supports(none.input.authorization),
      );

      // Zero compatible candidates must remain distinct from ambiguity and must
      // not trigger construction or selection of an implicit fallback handler.
      expect(matches).toHaveLength(0);
      expect(none.expected).toBeInstanceOf(Error);
      expect(none.expected).not.toEqual(many.expected);
      expect(() => resolver.resolve(none.input)).toThrow(none.expected);
      expect(() => resolver.resolve(none.input)).toThrow(none.expected);
      expect(none.input.authorization).toEqual(authorizationSnapshot);
      expect(none.input.handlers).toEqual(handlersSnapshot);
    });

    it("throws the deterministic ambiguity error without choosing by order", () => {
      const { many, none, resolver } = createFixture();
      const authorizationSnapshot = structuredClone(many.input.authorization);
      const handlersSnapshot = [...many.input.handlers];
      const matches = many.input.handlers.filter((handler) =>
        handler.supports(many.input.authorization),
      );

      // Counting the complete candidate collection prevents first-match order
      // from hiding an invalid configuration with multiple compatible handlers.
      expect(matches.length).toBeGreaterThan(1);
      expect(many.expected).toBeInstanceOf(Error);
      expect(many.expected).not.toEqual(none.expected);
      expect(() => resolver.resolve(many.input)).toThrow(many.expected);
      expect(() => resolver.resolve(many.input)).toThrow(many.expected);
      expect(many.input.authorization).toEqual(authorizationSnapshot);
      expect(many.input.handlers).toEqual(handlersSnapshot);
    });
  });
}
