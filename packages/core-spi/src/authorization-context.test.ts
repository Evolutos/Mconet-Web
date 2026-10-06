// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type {
  Extensions,
  ModelTarget,
  OpenIdentifier,
  Timestamp,
  UriValue,
} from "@evolutos/mconet-core-domain";

import type { AuthorizationContext } from "./authorization-context.js";

it("defines the exact non-sensitive authorization boundary", () => {
  // Exact equality prevents credentials, authorization configuration, request
  // headers, query fields, or bodies from entering this context later.
  expectTypeOf<AuthorizationContext>().toEqualTypeOf<{
    readonly interactionId: OpenIdentifier;
    readonly target: ModelTarget;
    readonly endpoint: Extract<UriValue, { readonly kind: "absolute" }>;
    readonly transportKind: OpenIdentifier;
    readonly timestamp: Timestamp;
    readonly bodySigningMode: "none";
    readonly signal: AbortSignal;
    readonly extensions: Extensions;
  }>();
});

it("retains resolved authorization facts and the live cancellation signal", () => {
  const controller = new AbortController();
  const context: AuthorizationContext = {
    interactionId: "interaction.example",
    target: {
      serviceId: "service.example",
      protocolId: "protocol.example",
      model: { name: "model-example", metadata: {}, extensions: {} },
      extensions: {},
    },
    endpoint: { kind: "absolute", value: "https://example.test/v1" },
    transportKind: "http",
    timestamp: { epochMilliseconds: 1_798_761_600_000 },
    bodySigningMode: "none",
    signal: controller.signal,
    extensions: { "provider.region": "test-region" },
  };

  // Assert the context preserves resolved identities and values without
  // rewriting them into transport-specific or mutable request structures.
  expect(context).toMatchObject({
    interactionId: "interaction.example",
    endpoint: { kind: "absolute", value: "https://example.test/v1" },
    transportKind: "http",
    timestamp: { epochMilliseconds: 1_798_761_600_000 },
    bodySigningMode: "none",
    extensions: { "provider.region": "test-region" },
  });

  // The original signal reference propagates cancellation that occurs after
  // the authorization context has already been constructed.
  expect(context.signal.aborted).toBe(false);
  controller.abort("authorization cancelled");
  expect(context.signal.aborted).toBe(true);
  expect(context.signal.reason).toBe("authorization cancelled");
});

it("rejects relative endpoints and unsupported signing modes", () => {
  // Authorization runs after endpoint resolution, and the initial Web runtime
  // rejects body signing before credentials or handlers are invoked.
  expectTypeOf<{ readonly kind: "relative"; readonly value: string }>().not.toMatchTypeOf<
    AuthorizationContext["endpoint"]
  >();
  expectTypeOf<"buffered_digest">().not.toMatchTypeOf<AuthorizationContext["bodySigningMode"]>();
});

it("prevents replacement of authorization facts", () => {
  const proveReadonly = (context: AuthorizationContext): void => {
    // Exercise a forbidden write only during type checking; the helper is not
    // invoked, so no runtime context is mutated by this assertion.
    // @ts-expect-error The resolved endpoint must remain stable during authorization.
    context.endpoint = { kind: "absolute", value: "https://other.test" };
  };

  // Keep the helper in the test program so strict TypeScript checking retains
  // the readonly assignment assertion without executing it.
  expectTypeOf(proveReadonly).toBeFunction();
});
