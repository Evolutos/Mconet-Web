// Copyright © 2026 Mcont.

import { ModelInteractionError } from "@evolutos/mconet-core-domain";
import { describe, expect, it } from "vitest";

import type { TaskProtocolAdapter } from "@evolutos/mconet-core-spi";

/** Complete reusable fixture required by the TaskProtocolAdapter contract suite. */
export interface TaskProtocolAdapterContractFixture {
  /** Fresh adapter instance tested by one isolated contract case. */
  readonly adapter: TaskProtocolAdapter;
  /** Support input and expected compatibility decision. */
  readonly support: Readonly<{
    input: Parameters<TaskProtocolAdapter["supports"]>[0];
    expected: ReturnType<TaskProtocolAdapter["supports"]>;
  }>;
  /** Planning input and expected normalized processing result. */
  readonly plan: Readonly<{
    input: Parameters<TaskProtocolAdapter["preparePlan"]>[0];
    expected: ReturnType<TaskProtocolAdapter["preparePlan"]>;
  }>;
  /** Request-mapping input and expected normalized processing result. */
  readonly request: Readonly<{
    input: Parameters<TaskProtocolAdapter["buildRequest"]>[0];
    expected: ReturnType<TaskProtocolAdapter["buildRequest"]>;
  }>;
  /** Successful payload input and expected normalized parsed response. */
  readonly response: Readonly<{
    input: Parameters<TaskProtocolAdapter["parseResponse"]>[0];
    expected: ReturnType<TaskProtocolAdapter["parseResponse"]>;
  }>;
  /** Service-error payload input and expected standard interaction error. */
  readonly error: Readonly<{
    input: Parameters<TaskProtocolAdapter["parseError"]>[0];
    expected: ReturnType<TaskProtocolAdapter["parseError"]>;
  }>;
}

/**
 * Registers the reusable behavioral contract for one TaskProtocolAdapter.
 *
 * @param name Stable implementation name shown in contract test reports.
 * @param createFixture Factory returning isolated adapter state and expectations.
 */
export function defineTaskProtocolAdapterContract(
  name: string,
  createFixture: () => TaskProtocolAdapterContractFixture,
): void {
  // Register one named suite so every implementation receives identical cases
  // while each case obtains fresh mutable state from the supplied factory.
  describe(`${name} TaskProtocolAdapter contract`, () => {
    it("reports the expected support decision without mutating its input", () => {
      const { adapter, support } = createFixture();
      const inputSnapshot = structuredClone(support.input);

      // Support inspection is synchronous, deterministic for one input, and has
      // no authority to rewrite target, task, or mode facts.
      expect(adapter.supports(support.input)).toBe(support.expected);
      expect(adapter.supports(support.input)).toBe(support.expected);
      expect(support.input).toEqual(inputSnapshot);
    });

    it("prepares a deterministic plan without mutating request policy or mode", () => {
      const { adapter, plan } = createFixture();
      const inputSnapshot = structuredClone(plan.input);

      // Structural equality permits fresh immutable result objects while proving
      // repeat calls expose the same normalized plan and diagnostics.
      const first = adapter.preparePlan(plan.input);
      const second = adapter.preparePlan(plan.input);
      expect(first).toEqual(plan.expected);
      expect(second).toEqual(plan.expected);
      expect(second).toEqual(first);
      expect(plan.input).toEqual(inputSnapshot);
    });

    it("builds the expected unencoded request without mutating request or plan", () => {
      const { adapter, request } = createFixture();
      const inputSnapshot = structuredClone(request.input);

      // Request mapping must remain below encoding and authorization, returning
      // the implementation's normalized ProcessingResult only.
      expect(adapter.buildRequest(request.input)).toEqual(request.expected);
      expect(request.input).toEqual(inputSnapshot);
    });

    it("normalizes a successful payload without mutating payload or metadata", () => {
      const { adapter, response } = createFixture();
      const inputSnapshot = structuredClone(response.input);

      // The expected ProcessingResult fixes parsed task status, protocol state,
      // diagnostics, and extensions without consuming transport evidence.
      expect(adapter.parseResponse(response.input)).toEqual(response.expected);
      expect(response.input).toEqual(inputSnapshot);
    });

    it("normalizes a service payload to ModelInteractionError without input mutation", () => {
      const { adapter, error } = createFixture();
      const inputSnapshot = structuredClone(error.input);

      // A standard runtime error instance proves service failures do not escape
      // as provider DTOs, strings, or arbitrary thrown values.
      const actual = adapter.parseError(error.input);
      expect(actual).toBeInstanceOf(ModelInteractionError);
      expect(actual).toEqual(error.expected);
      expect(error.input).toEqual(inputSnapshot);
    });
  });
}
