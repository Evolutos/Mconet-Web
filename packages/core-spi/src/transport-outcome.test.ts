// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type { OpenIdentifier } from "@evolutos/mconet-core-domain";

import type { TransportOutcome } from "./transport-outcome.js";

it("defines the standard outcomes while retaining an open identifier arm", () => {
  // Exact equality keeps the portable standard vocabulary visible to consumers
  // without closing transports to integration-defined normalized outcomes.
  expectTypeOf<TransportOutcome>().toEqualTypeOf<
    "success" | "service_error" | "transport_error" | (OpenIdentifier & Record<never, never>)
  >();
});

it("keeps every standard transport classification distinct", () => {
  const outcomes = [
    "success",
    "service_error",
    "transport_error",
  ] as const satisfies readonly TransportOutcome[];

  // These values classify the transport result only; none implies a native
  // status code, payload decoder, media type, retry, or error-body semantics.
  expect(outcomes).toEqual(["success", "service_error", "transport_error"]);
  expect(new Set(outcomes).size).toBe(outcomes.length);
});

it("preserves an integration-defined outcome without fallback conversion", () => {
  const outcome: TransportOutcome = "vendor.partial_response";

  // Open values remain exact instead of collapsing to transport_error or a
  // generic unknown value, allowing later components to handle new outcomes.
  expect(outcome).toBe("vendor.partial_response");
  expectTypeOf(outcome).toMatchTypeOf<OpenIdentifier>();
});

it("rejects values outside the open string identifier representation", () => {
  // Type-level rejection prevents callers from substituting status numbers or
  // booleans for a normalized outcome before runtime validation is introduced.
  expectTypeOf<number>().not.toMatchTypeOf<TransportOutcome>();
  expectTypeOf<boolean>().not.toMatchTypeOf<TransportOutcome>();
  expectTypeOf<{ readonly id: string }>().not.toMatchTypeOf<TransportOutcome>();
});
