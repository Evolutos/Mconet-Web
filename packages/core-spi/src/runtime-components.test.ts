// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type { AuthorizationHandler } from "./authorization-handler.js";
import type { AuthorizationHandlerResolver } from "./authorization-handler-resolver.js";
import type { ModelIntegrationResolver } from "./model-integration-resolver.js";
import type { PayloadDecoder } from "./payload-decoder.js";
import type { PayloadEncoder } from "./payload-encoder.js";
import type { RuntimeComponents } from "./runtime-components.js";
import type { ServiceAccessResolver } from "./service-access-resolver.js";
import type { TaskProtocolAdapter } from "./task-protocol-adapter.js";
import type { Transport } from "./transport.js";

it("defines only the supported optional component injection surface", () => {
  // Exact equality prevents executable-path placeholders and mutable candidate
  // arrays from entering the initial Runtime component configuration.
  expectTypeOf<RuntimeComponents>().toEqualTypeOf<{
    readonly modelIntegrationResolver?: ModelIntegrationResolver;
    readonly taskProtocolAdapter?: TaskProtocolAdapter;
    readonly serviceAccessResolver?: ServiceAccessResolver;
    readonly payloadEncoder?: PayloadEncoder;
    readonly successPayloadDecoder?: PayloadDecoder;
    readonly errorPayloadDecoder?: PayloadDecoder;
    readonly transport?: Transport;
    readonly authorizationHandlerResolver?: AuthorizationHandlerResolver;
    readonly authorizationHandlers?: readonly AuthorizationHandler[];
  }>();
});

it("supports an empty layer and preserves explicitly injected identities", () => {
  const empty: RuntimeComponents = {};
  const transportFailure = new Error("Transport fixture must not send network traffic.");
  const transport: Transport = {
    descriptor: {
      name: "fixture-transport",
      version: "1.0.0",
      capabilities: new Set(),
      source: "application",
    },
    send() {
      // Reject if accidentally called because this test verifies configuration
      // identity only and must never perform or imitate transport behavior.
      return Promise.reject(transportFailure);
    },
  };
  const authorizationHandlers: readonly AuthorizationHandler[] = [];
  const configured: RuntimeComponents = { transport, authorizationHandlers };

  // Absence remains a valid layer, while supplied component instances and the
  // ordered candidate collection cross the configuration boundary unchanged.
  expect(empty).toEqual({});
  expect(configured.transport).toBe(transport);
  expect(configured.authorizationHandlers).toBe(authorizationHandlers);
});

it("prevents replacement of component choices and candidate membership", () => {
  const proveReadonly = (
    components: RuntimeComponents,
    adapter: TaskProtocolAdapter,
    handler: AuthorizationHandler,
  ): void => {
    // This compile-only helper locks each layer's final direct choice and the
    // membership of the multi-handler candidate snapshot.
    // @ts-expect-error A direct adapter choice cannot be replaced in place.
    components.taskProtocolAdapter = adapter;
    // @ts-expect-error Authorization handler membership cannot be extended in place.
    components.authorizationHandlers?.push(handler);
  };

  expectTypeOf(proveReadonly).toBeFunction();
});

it("does not expose unsupported streaming artifact or operation components", () => {
  // New execution families must add real typed fields only when their complete
  // behavior and Runtime call paths exist, rather than reserving inert options.
  expectTypeOf<RuntimeComponents>().not.toHaveProperty("streamingTransport");
  expectTypeOf<RuntimeComponents>().not.toHaveProperty("streamFramer");
  expectTypeOf<RuntimeComponents>().not.toHaveProperty("artifactResolver");
  expectTypeOf<RuntimeComponents>().not.toHaveProperty("artifactReaders");
  expectTypeOf<RuntimeComponents>().not.toHaveProperty("operationProtocolAdapter");
});
