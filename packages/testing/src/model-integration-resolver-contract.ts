// Copyright © 2026 Mcont.

import { describe, expect, it } from "vitest";

import type { ModelIntegrationResolver } from "@evolutos/mconet-core-spi";

/** Complete reusable fixture required by the ModelIntegrationResolver contract suite. */
export interface ModelIntegrationResolverContractFixture {
  /** Fresh resolver configured to produce one uniquely matched plan. */
  readonly exactResolver: ModelIntegrationResolver;
  /** Exact-match input and expected complete integration plan. */
  readonly exact: Readonly<{
    input: Parameters<ModelIntegrationResolver["resolve"]>[0];
    expected: ReturnType<ModelIntegrationResolver["resolve"]>;
  }>;
  /** Fresh resolver configured with no matching integration. */
  readonly noneResolver: ModelIntegrationResolver;
  /** No-match input and expected deterministic resolution error. */
  readonly none: Readonly<{
    input: Parameters<ModelIntegrationResolver["resolve"]>[0];
    expected: Error;
  }>;
  /** Fresh resolver configured with multiple equally valid integrations. */
  readonly ambiguousResolver: ModelIntegrationResolver;
  /** Ambiguous-match input and expected deterministic resolution error. */
  readonly ambiguous: Readonly<{
    input: Parameters<ModelIntegrationResolver["resolve"]>[0];
    expected: Error;
  }>;
}

/**
 * Registers the reusable behavioral contract for one ModelIntegrationResolver.
 *
 * @param name Stable implementation name shown in contract test reports.
 * @param createFixture Factory returning isolated exact and failure fixtures.
 */
export function defineModelIntegrationResolverContract(
  name: string,
  createFixture: () => ModelIntegrationResolverContractFixture,
): void {
  // Register independent cases so resolver state or input mutation in one match
  // outcome cannot influence another outcome's deterministic result.
  describe(`${name} ModelIntegrationResolver contract`, () => {
    it("returns one deterministic complete plan for an exact match", () => {
      const { exactResolver, exact } = createFixture();
      const inputSnapshot = structuredClone(exact.input);

      // A resolver-selected plan must carry binding provenance and successful
      // target/task facts instead of returning a direct or partial plan.
      expect(exact.expected.source).toBe("resolved_binding");
      expect(exact.expected.bindingId?.length).toBeGreaterThan(0);
      expect(exact.expected.bindingVersion?.length).toBeGreaterThan(0);
      expect(exact.expected.match?.target.matched).toBe(true);
      expect(exact.expected.match?.task.matched).toBe(true);

      const first = exactResolver.resolve(exact.input);
      const second = exactResolver.resolve(exact.input);
      expect(first).toEqual(exact.expected);
      expect(second).toEqual(exact.expected);
      expect(second).toEqual(first);
      expect(exact.input).toEqual(inputSnapshot);
    });

    it("throws the deterministic no-match error without mutating input", () => {
      const { ambiguous, none, noneResolver } = createFixture();
      const inputSnapshot = structuredClone(none.input);

      // No candidate is a terminal resolution result distinct from ambiguity;
      // the resolver must not fabricate a plan or silently select a fallback.
      expect(none.expected).toBeInstanceOf(Error);
      expect(none.expected).not.toEqual(ambiguous.expected);
      expect(() => noneResolver.resolve(none.input)).toThrow(none.expected);
      expect(() => noneResolver.resolve(none.input)).toThrow(none.expected);
      expect(none.input).toEqual(inputSnapshot);
    });

    it("throws the deterministic ambiguity error without mutating input", () => {
      const { ambiguous, ambiguousResolver, none } = createFixture();
      const inputSnapshot = structuredClone(ambiguous.input);

      // Multiple equally valid candidates must fail explicitly and remain
      // distinguishable from no match instead of relying on declaration order.
      expect(ambiguous.expected).toBeInstanceOf(Error);
      expect(ambiguous.expected).not.toEqual(none.expected);
      expect(() => ambiguousResolver.resolve(ambiguous.input)).toThrow(ambiguous.expected);
      expect(() => ambiguousResolver.resolve(ambiguous.input)).toThrow(ambiguous.expected);
      expect(ambiguous.input).toEqual(inputSnapshot);
    });
  });
}
