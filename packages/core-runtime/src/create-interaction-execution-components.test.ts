// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type { ResolvedInteractionResourceLimits } from "@evolutos/mconet-core-domain";
import type {
  AuthorizationHandler,
  AuthorizationHandlerResolver,
  CapabilityResolution,
  ComponentDescriptor,
  ComponentSelectionResolution,
  InteractionExecutionComponents,
  ModelIntegrationPlan,
  PayloadDecoder,
  PayloadEncoder,
  ServiceAccessResolver,
  TaskProtocolAdapter,
  Transport,
} from "@evolutos/mconet-core-spi";

import { createInteractionExecutionComponents } from "./create-interaction-execution-components.js";

it("exposes one exact execution snapshot factory signature", () => {
  // The complete SPI value itself is the input boundary, preventing optional
  // configuration fields or unvalidated partial component bags from entering.
  expectTypeOf(createInteractionExecutionComponents).toEqualTypeOf<
    (input: InteractionExecutionComponents) => InteractionExecutionComponents
  >();
});

it("creates a frozen snapshot while preserving every validated identity", () => {
  const fixture = createFixture();

  const snapshot = createInteractionExecutionComponents(fixture.input);

  // Single-value components and prior resolution facts are already validated;
  // the factory retains them exactly and never reconstructs or reselects them.
  expect(snapshot).not.toBe(fixture.input);
  expect(snapshot.integrationPlan).toBe(fixture.input.integrationPlan);
  expect(snapshot.componentSelection).toBe(fixture.input.componentSelection);
  expect(snapshot.resourceLimits).toBe(fixture.input.resourceLimits);
  expect(snapshot.taskProtocolAdapter).toBe(fixture.input.taskProtocolAdapter);
  expect(snapshot.serviceAccessResolver).toBe(fixture.input.serviceAccessResolver);
  expect(snapshot.payloadEncoder).toBe(fixture.input.payloadEncoder);
  expect(snapshot.successPayloadDecoder).toBe(fixture.input.successPayloadDecoder);
  expect(snapshot.errorPayloadDecoder).toBe(fixture.input.errorPayloadDecoder);
  expect(snapshot.transport).toBe(fixture.input.transport);
  expect(snapshot.authorizationHandlerResolver).toBe(fixture.input.authorizationHandlerResolver);
  expect(snapshot.capabilityResolution).toBe(fixture.input.capabilityResolution);
  expect(Object.isFrozen(snapshot)).toBe(true);

  // Shallow ownership is intentional: injected behaviors and prior snapshots are
  // not frozen or otherwise claimed by this per-interaction envelope.
  expect(Object.isFrozen(fixture.input.taskProtocolAdapter)).toBe(false);
  expect(Object.isFrozen(fixture.input.integrationPlan)).toBe(false);
  expect(Object.isFrozen(fixture.input.resourceLimits)).toBe(false);
});

it("copies and freezes authorization handler membership without changing order", () => {
  const fixture = createFixture();
  const snapshot = createInteractionExecutionComponents(fixture.input);

  // The candidate list is the only caller-owned collection directly embedded by
  // this snapshot. Copying isolates later source-array membership mutations.
  expect(snapshot.authorizationHandlers).not.toBe(fixture.sourceHandlers);
  expect(snapshot.authorizationHandlers).toEqual([
    fixture.firstHandler,
    fixture.secondHandler,
    fixture.firstHandler,
  ]);
  expect(snapshot.authorizationHandlers[0]).toBe(fixture.firstHandler);
  expect(snapshot.authorizationHandlers[1]).toBe(fixture.secondHandler);
  expect(snapshot.authorizationHandlers[2]).toBe(fixture.firstHandler);
  expect(Object.isFrozen(snapshot.authorizationHandlers)).toBe(true);

  fixture.sourceHandlers.push(fixture.secondHandler);

  // Source mutation remains owned by the caller and cannot alter an in-flight
  // snapshot. Duplicate candidate identities and declaration order are retained.
  expect(fixture.sourceHandlers).toHaveLength(4);
  expect(snapshot.authorizationHandlers).toHaveLength(3);
  expect(fixture.input.authorizationHandlers).toBe(fixture.sourceHandlers);
});

it("allocates independent envelopes and handler arrays for each interaction", () => {
  const fixture = createFixture();

  const first = createInteractionExecutionComponents(fixture.input);
  const second = createInteractionExecutionComponents(fixture.input);

  // Each interaction owns its envelope and candidate membership snapshot while
  // safely reusing the same validated stateless component identities.
  expect(first).not.toBe(second);
  expect(first.authorizationHandlers).not.toBe(second.authorizationHandlers);
  expect(first.authorizationHandlers).toEqual(second.authorizationHandlers);
  expect(first.taskProtocolAdapter).toBe(second.taskProtocolAdapter);
  expect(first.transport).toBe(second.transport);
  expect(first.capabilityResolution).toBe(second.capabilityResolution);
});

/** Creates a complete inert validated-input fixture for snapshot assembly. */
function createFixture(): {
  readonly input: InteractionExecutionComponents;
  readonly sourceHandlers: AuthorizationHandler[];
  readonly firstHandler: AuthorizationHandler;
  readonly secondHandler: AuthorizationHandler;
} {
  const descriptor: ComponentDescriptor = {
    name: "execution-fixture",
    version: "1.0.0",
    capabilities: new Set(),
    source: "application",
  };
  const taskProtocolAdapter: TaskProtocolAdapter = {
    descriptor,
    // Every behavior points at the same deterministic failure. Snapshot assembly
    // is storage-only, so any invocation immediately fails the test.
    supports: failUnexpectedCall,
    preparePlan: failUnexpectedCall,
    buildRequest: failUnexpectedCall,
    parseResponse: failUnexpectedCall,
    parseError: failUnexpectedCall,
  };
  const serviceAccessResolver: ServiceAccessResolver = {
    descriptor,
    resolve: failUnexpectedCall,
  };
  const payloadEncoder: PayloadEncoder = {
    descriptor,
    encode: failUnexpectedCall,
  };
  const successPayloadDecoder: PayloadDecoder = {
    descriptor,
    decode: failUnexpectedCall,
  };
  const errorPayloadDecoder: PayloadDecoder = {
    descriptor,
    decode: failUnexpectedCall,
  };
  const transport: Transport = {
    descriptor,
    send: failUnexpectedCall,
  };
  const authorizationHandlerResolver: AuthorizationHandlerResolver = {
    descriptor,
    resolve: failUnexpectedCall,
  };
  const firstHandler: AuthorizationHandler = {
    descriptor,
    supports: failUnexpectedCall,
    apply: failUnexpectedCall,
  };
  const secondHandler: AuthorizationHandler = {
    descriptor,
    supports: failUnexpectedCall,
    apply: failUnexpectedCall,
  };
  const sourceHandlers: AuthorizationHandler[] = [firstHandler, secondHandler, firstHandler];
  const integrationPlan: ModelIntegrationPlan = {
    source: "direct_adapter",
    taskProtocolAdapter,
    authorizationHandlers: sourceHandlers,
    payloadEncoders: [payloadEncoder],
    payloadDecoders: [successPayloadDecoder, errorPayloadDecoder],
    transports: [transport],
    extensions: {},
  };
  const componentSelection: ComponentSelectionResolution = { components: [] };
  const resourceLimits: ResolvedInteractionResourceLimits = {
    maxResponseBodyBytes: 1_048_576,
    maxStreamingErrorBodyBytes: 65_536,
    maxFrameBytes: 262_144,
  };
  const capabilityResolution: CapabilityResolution = {
    satisfied: [],
    optionalUnsupported: [],
    diagnostics: [],
  };
  const input: InteractionExecutionComponents = {
    integrationPlan,
    componentSelection,
    resourceLimits,
    taskProtocolAdapter,
    serviceAccessResolver,
    payloadEncoder,
    successPayloadDecoder,
    errorPayloadDecoder,
    transport,
    authorizationHandlerResolver,
    authorizationHandlers: sourceHandlers,
    capabilityResolution,
  };

  // Return both the complete input and observable list members so tests can prove
  // identity preservation, duplicate retention, and mutation isolation.
  return { input, sourceHandlers, firstHandler, secondHandler };
}

/** Fails if snapshot construction invokes any stored component behavior. */
function failUnexpectedCall(): never {
  // A plain local error is sufficient because this is a test-only sentinel and no
  // Runtime error normalization stage should ever be reached by the factory.
  throw new Error("execution snapshot factory invoked component behavior");
}
