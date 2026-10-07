// Copyright © 2026 Mcont.

import { describe, expect, it } from "vitest";

import type { Transport } from "@evolutos/mconet-core-spi";

/** Complete reusable fixture required by the Transport contract suite. */
export interface TransportContractFixture {
  /** Fresh transport used to verify a normalized successful outcome. */
  readonly successTransport: Transport;
  /** Successful exchange inputs, expected response, and resource observation. */
  readonly success: Readonly<{
    request: Parameters<Transport["send"]>[0];
    context: Parameters<Transport["send"]>[1];
    expected: Awaited<ReturnType<Transport["send"]>>;
    isReleased: () => boolean;
  }>;
  /** Fresh transport used to verify a normalized service-error outcome. */
  readonly serviceErrorTransport: Transport;
  /** Service-error exchange inputs, expected response, and resource observation. */
  readonly serviceError: Readonly<{
    request: Parameters<Transport["send"]>[0];
    context: Parameters<Transport["send"]>[1];
    expected: Awaited<ReturnType<Transport["send"]>>;
    isReleased: () => boolean;
  }>;
  /** Fresh transport used to verify observation of in-flight cancellation. */
  readonly cancellationTransport: Transport;
  /** Pending exchange, cancellation trigger, error, and resource observation. */
  readonly cancellation: Readonly<{
    request: Parameters<Transport["send"]>[0];
    context: Parameters<Transport["send"]>[1];
    abort: () => void;
    expected: Error;
    isReleased: () => boolean;
  }>;
  /** Fresh transport used to verify bounded response collection. */
  readonly oversizedTransport: Transport;
  /** Over-limit exchange evidence, error, and resource observation. */
  readonly oversized: Readonly<{
    request: Parameters<Transport["send"]>[0];
    context: Parameters<Transport["send"]>[1];
    observedResponseBodyBytes: number;
    expected: Error;
    isReleased: () => boolean;
  }>;
}

/**
 * Registers the reusable behavioral contract for one unary Transport.
 *
 * @param name Stable implementation name shown in contract test reports.
 * @param createFixture Factory returning isolated outcome and failure fixtures.
 */
export function defineTransportContract(
  name: string,
  createFixture: () => TransportContractFixture,
): void {
  // Isolate every exchange so cancellation, resource state, or byte accounting
  // from one transport invocation cannot make another contract case pass.
  describe(`${name} Transport contract`, () => {
    it("returns a bounded success outcome and releases transport resources", async () => {
      const { successTransport, success } = createFixture();
      const requestSnapshot = structuredClone(success.request);
      const signal = success.context.signal;
      const deadline = success.context.deadline;
      const maxResponseBodyBytes = success.context.maxResponseBodyBytes;

      // A fulfilled send must preserve its protocol-neutral outcome, stay within
      // the caller's limit, and finish transport-owned cleanup before settlement.
      expect(success.expected.metadata.outcome).toBe("success");
      expect(success.expected.body.byteLength).toBeLessThanOrEqual(
        success.context.maxResponseBodyBytes,
      );
      expect(success.isReleased()).toBe(false);
      await expect(successTransport.send(success.request, success.context)).resolves.toEqual(
        success.expected,
      );
      expect(success.isReleased()).toBe(true);
      expect(success.request).toEqual(requestSnapshot);
      expect(success.context.signal).toBe(signal);
      expect(success.context.deadline).toBe(deadline);
      expect(success.context.maxResponseBodyBytes).toBe(maxResponseBodyBytes);
    });

    it("returns a bounded service-error outcome and releases transport resources", async () => {
      const { serviceErrorTransport, serviceError } = createFixture();
      const requestSnapshot = structuredClone(serviceError.request);
      const signal = serviceError.context.signal;
      const deadline = serviceError.context.deadline;
      const maxResponseBodyBytes = serviceError.context.maxResponseBodyBytes;

      // Service rejection remains a response classification with undecoded body
      // bytes; it is not converted into a thrown provider or protocol error.
      expect(serviceError.expected.metadata.outcome).toBe("service_error");
      expect(serviceError.expected.body.byteLength).toBeLessThanOrEqual(
        serviceError.context.maxResponseBodyBytes,
      );
      expect(serviceError.isReleased()).toBe(false);
      await expect(
        serviceErrorTransport.send(serviceError.request, serviceError.context),
      ).resolves.toEqual(serviceError.expected);
      expect(serviceError.isReleased()).toBe(true);
      expect(serviceError.request).toEqual(requestSnapshot);
      expect(serviceError.context.signal).toBe(signal);
      expect(serviceError.context.deadline).toBe(deadline);
      expect(serviceError.context.maxResponseBodyBytes).toBe(maxResponseBodyBytes);
    });

    it("rejects an in-flight cancelled exchange and releases transport resources", async () => {
      const { cancellationTransport, cancellation } = createFixture();
      const requestSnapshot = structuredClone(cancellation.request);
      const signal = cancellation.context.signal;
      const deadline = cancellation.context.deadline;
      const maxResponseBodyBytes = cancellation.context.maxResponseBodyBytes;

      // Start before aborting to prove the transport observes an in-flight signal
      // transition instead of merely rejecting a pre-cancelled fixture.
      expect(signal.aborted).toBe(false);
      expect(cancellation.expected).toBeInstanceOf(Error);
      expect(cancellation.isReleased()).toBe(false);
      const attempt = cancellationTransport.send(cancellation.request, cancellation.context);
      cancellation.abort();
      expect(signal.aborted).toBe(true);
      await expect(attempt).rejects.toBeInstanceOf(Error);
      await expect(attempt).rejects.toEqual(cancellation.expected);
      expect(cancellation.isReleased()).toBe(true);
      expect(cancellation.request).toEqual(requestSnapshot);
      expect(cancellation.context.signal).toBe(signal);
      expect(cancellation.context.deadline).toBe(deadline);
      expect(cancellation.context.maxResponseBodyBytes).toBe(maxResponseBodyBytes);
    });

    it("rejects an oversized response and releases transport resources", async () => {
      const { oversizedTransport, oversized } = createFixture();
      const requestSnapshot = structuredClone(oversized.request);
      const signal = oversized.context.signal;
      const deadline = oversized.context.deadline;
      const maxResponseBodyBytes = oversized.context.maxResponseBodyBytes;

      // Recorded source bytes must cross the configured boundary, distinguishing
      // a size-limit failure from an unrelated network or response parse error.
      expect(Number.isSafeInteger(oversized.context.maxResponseBodyBytes)).toBe(true);
      expect(oversized.context.maxResponseBodyBytes).toBeGreaterThanOrEqual(0);
      expect(Number.isSafeInteger(oversized.observedResponseBodyBytes)).toBe(true);
      expect(oversized.observedResponseBodyBytes).toBeGreaterThan(
        oversized.context.maxResponseBodyBytes,
      );
      expect(oversized.expected).toBeInstanceOf(Error);
      expect(oversized.isReleased()).toBe(false);
      const attempt = oversizedTransport.send(oversized.request, oversized.context);
      await expect(attempt).rejects.toBeInstanceOf(Error);
      await expect(attempt).rejects.toEqual(oversized.expected);
      expect(oversized.isReleased()).toBe(true);
      expect(oversized.request).toEqual(requestSnapshot);
      expect(oversized.context.signal).toBe(signal);
      expect(oversized.context.deadline).toBe(deadline);
      expect(oversized.context.maxResponseBodyBytes).toBe(maxResponseBodyBytes);
    });
  });
}
