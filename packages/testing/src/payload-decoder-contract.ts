// Copyright © 2026 Mcont.

import { describe, expect, it } from "vitest";

import type { PayloadDecoder } from "@evolutos/mconet-core-spi";

/** Complete reusable fixture required by the PayloadDecoder contract suite. */
export interface PayloadDecoderContractFixture {
  /** Maximum byte length accepted by every decoder in this fixture. */
  readonly maxInputBytes: number;
  /** Fresh decoder used to verify successful payload decoding. */
  readonly decoder: PayloadDecoder;
  /** Valid bounded bytes, lifecycle context, and expected decoded value. */
  readonly success: Readonly<{
    bytes: Parameters<PayloadDecoder["decode"]>[0];
    context: Parameters<PayloadDecoder["decode"]>[1];
    expected: Awaited<ReturnType<PayloadDecoder["decode"]>>;
  }>;
  /** Fresh decoder used to verify invalid payload rejection. */
  readonly invalidPayloadDecoder: PayloadDecoder;
  /** Invalid but size-compliant bytes and the expected decoding error. */
  readonly invalidPayload: Readonly<{
    bytes: Parameters<PayloadDecoder["decode"]>[0];
    context: Parameters<PayloadDecoder["decode"]>[1];
    expected: Error;
  }>;
  /** Fresh decoder used to verify oversized payload rejection. */
  readonly oversizedPayloadDecoder: PayloadDecoder;
  /** Bytes beyond the configured limit and the expected size error. */
  readonly oversizedPayload: Readonly<{
    bytes: Parameters<PayloadDecoder["decode"]>[0];
    context: Parameters<PayloadDecoder["decode"]>[1];
    expected: Error;
  }>;
}

/**
 * Registers the reusable behavioral contract for one PayloadDecoder.
 *
 * @param name Stable implementation name shown in contract test reports.
 * @param createFixture Factory returning isolated success and failure fixtures.
 */
export function definePayloadDecoderContract(
  name: string,
  createFixture: () => PayloadDecoderContractFixture,
): void {
  // Register each outcome separately so mutable decoder state or byte-array
  // changes from one path cannot conceal a violation on another path.
  describe(`${name} PayloadDecoder contract`, () => {
    it("decodes valid bounded bytes without mutating bytes or context", async () => {
      const { decoder, maxInputBytes, success } = createFixture();
      const bytesSnapshot = success.bytes.slice();
      const signal = success.context.signal;

      // Prove the fixture exercises the bounded success path before checking the
      // decoder's public result and preservation of caller-owned inputs.
      expect(Number.isSafeInteger(maxInputBytes)).toBe(true);
      expect(maxInputBytes).toBeGreaterThanOrEqual(0);
      expect(success.bytes.byteLength).toBeLessThanOrEqual(maxInputBytes);
      await expect(decoder.decode(success.bytes, success.context)).resolves.toEqual(
        success.expected,
      );
      expect(success.bytes).toEqual(bytesSnapshot);
      expect(success.context.signal).toBe(signal);
    });

    it("rejects invalid size-compliant bytes with the expected decoding error", async () => {
      const { invalidPayloadDecoder, invalidPayload, maxInputBytes } = createFixture();
      const bytesSnapshot = invalidPayload.bytes.slice();
      const signal = invalidPayload.context.signal;

      // Keep malformed-content behavior distinct from size enforcement, then
      // require a normalized Error without imposing object identity on decoders.
      expect(invalidPayload.bytes.byteLength).toBeLessThanOrEqual(maxInputBytes);
      expect(invalidPayload.expected).toBeInstanceOf(Error);
      const attempt = invalidPayloadDecoder.decode(invalidPayload.bytes, invalidPayload.context);
      await expect(attempt).rejects.toBeInstanceOf(Error);
      await expect(attempt).rejects.toEqual(invalidPayload.expected);
      expect(invalidPayload.bytes).toEqual(bytesSnapshot);
      expect(invalidPayload.context.signal).toBe(signal);
    });

    it("rejects bytes beyond the configured limit with the expected size error", async () => {
      const { maxInputBytes, oversizedPayloadDecoder, oversizedPayload } = createFixture();
      const bytesSnapshot = oversizedPayload.bytes.slice();
      const signal = oversizedPayload.context.signal;

      // Assert the test data crosses the declared boundary so an invalid-content
      // error cannot accidentally satisfy the independent size-limit contract.
      expect(oversizedPayload.bytes.byteLength).toBeGreaterThan(maxInputBytes);
      expect(oversizedPayload.expected).toBeInstanceOf(Error);
      const attempt = oversizedPayloadDecoder.decode(
        oversizedPayload.bytes,
        oversizedPayload.context,
      );
      await expect(attempt).rejects.toBeInstanceOf(Error);
      await expect(attempt).rejects.toEqual(oversizedPayload.expected);
      expect(oversizedPayload.bytes).toEqual(bytesSnapshot);
      expect(oversizedPayload.context.signal).toBe(signal);
    });
  });
}
