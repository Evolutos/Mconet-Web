// Copyright © 2026 Mcont.

import { describe, expect, it } from "vitest";

import type { PayloadEncoder } from "@evolutos/mconet-core-spi";

/** Complete reusable fixture required by the PayloadEncoder contract suite. */
export interface PayloadEncoderContractFixture {
  /** Fresh encoder used to verify successful encoding. */
  readonly encoder: PayloadEncoder;
  /** Successful input pair and expected transport body. */
  readonly success: Readonly<{
    value: Parameters<PayloadEncoder["encode"]>[0];
    context: Parameters<PayloadEncoder["encode"]>[1];
    expected: Awaited<ReturnType<PayloadEncoder["encode"]>>;
  }>;
  /** Fresh encoder used to verify normalized failure propagation. */
  readonly failingEncoder: PayloadEncoder;
  /** Failing input pair and exact expected Error rejection. */
  readonly failure: Readonly<{
    value: Parameters<PayloadEncoder["encode"]>[0];
    context: Parameters<PayloadEncoder["encode"]>[1];
    expected: Error;
  }>;
}

/**
 * Registers the reusable behavioral contract for one PayloadEncoder.
 *
 * @param name Stable implementation name shown in contract test reports.
 * @param createFixture Factory returning isolated success and failure fixtures.
 */
export function definePayloadEncoderContract(
  name: string,
  createFixture: () => PayloadEncoderContractFixture,
): void {
  // Register isolated success and failure cases so an implementation can prove
  // its input boundary without starting Runtime or a transport.
  describe(`${name} PayloadEncoder contract`, () => {
    it("encodes the expected body without mutating value or context", async () => {
      const { encoder, success } = createFixture();
      const valueSnapshot = structuredClone(success.value);
      const signal = success.context.signal;

      // The erased value remains untouched and the exact composed signal stays
      // on the original context while the encoder returns its expected body.
      await expect(encoder.encode(success.value, success.context)).resolves.toEqual(
        success.expected,
      );
      expect(success.value).toEqual(valueSnapshot);
      expect(success.context.signal).toBe(signal);
    });

    it("rejects with the expected Error without mutating value or context", async () => {
      const { failingEncoder, failure } = createFixture();
      const valueSnapshot = structuredClone(failure.value);
      const signal = failure.context.signal;

      // Requiring a real Error rejects strings and provider DTOs while identity
      // equality proves the encoder boundary does not wrap the configured cause.
      expect(failure.expected).toBeInstanceOf(Error);
      await expect(failingEncoder.encode(failure.value, failure.context)).rejects.toBe(
        failure.expected,
      );
      expect(failure.value).toEqual(valueSnapshot);
      expect(failure.context.signal).toBe(signal);
    });
  });
}
