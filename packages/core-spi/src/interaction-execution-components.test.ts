// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import {
  ModelInteractionError,
  type ResolvedInteractionResourceLimits,
} from "@evolutos/mconet-core-domain";

import type { AuthorizationHandler } from "./authorization-handler.js";
import type { AuthorizationHandlerResolver } from "./authorization-handler-resolver.js";
import type { CapabilityResolution } from "./capability-resolution.js";
import type { ComponentSelectionResolution } from "./component-selection-resolution.js";
import type { InteractionExecutionComponents } from "./interaction-execution-components.js";
import type { ModelIntegrationPlan } from "./model-integration-plan.js";
import type { PayloadDecoder } from "./payload-decoder.js";
import type { PayloadEncoder } from "./payload-encoder.js";
import type { ServiceAccessResolver } from "./service-access-resolver.js";
import type { TaskProtocolAdapter } from "./task-protocol-adapter.js";
import type { Transport } from "./transport.js";

it("defines the exact complete unary execution snapshot", () => {
  // Exact equality rejects optional execution components, unvalidated mutable
  // configuration, and placeholders for unsupported interaction families.
  expectTypeOf<InteractionExecutionComponents>().toEqualTypeOf<{
    readonly integrationPlan: ModelIntegrationPlan;
    readonly componentSelection: ComponentSelectionResolution;
    readonly resourceLimits: ResolvedInteractionResourceLimits;
    readonly taskProtocolAdapter: TaskProtocolAdapter;
    readonly serviceAccessResolver: ServiceAccessResolver;
    readonly payloadEncoder: PayloadEncoder;
    readonly successPayloadDecoder: PayloadDecoder;
    readonly errorPayloadDecoder: PayloadDecoder;
    readonly transport: Transport;
    readonly authorizationHandlerResolver: AuthorizationHandlerResolver;
    readonly authorizationHandlers: readonly AuthorizationHandler[];
    readonly capabilityResolution: CapabilityResolution;
  }>();
});

it("preserves every resolved component and validation result identity", () => {
  const descriptor = {
    name: "fixture-execution-component",
    version: "1.0.0",
    capabilities: new Set<string>(),
    source: "application" as const,
  };
  const taskProtocolAdapter: TaskProtocolAdapter = {
    descriptor,
    supports() {
      // The fixture supports the typed tuple so the snapshot can retain one
      // complete Adapter without duplicating real integration matching logic.
      return true;
    },
    preparePlan() {
      // No method is invoked by this value-object test; fail immediately if the
      // snapshot accidentally starts executing adapter planning behavior.
      return failUnexpectedCall();
    },
    buildRequest() {
      // Request mapping belongs to later Runtime stages and must not occur while
      // constructing or observing an execution component snapshot.
      return failUnexpectedCall();
    },
    parseResponse() {
      // Response parsing requires decoded network output and is deliberately
      // unavailable to this identity-only fixture.
      return failUnexpectedCall();
    },
    parseError() {
      // Service-error parsing is also a later execution concern; the helper
      // reports any accidental invocation deterministically.
      return failUnexpectedCall();
    },
  };
  const serviceAccessResolver: ServiceAccessResolver = {
    descriptor,
    resolve() {
      // Access resolution already precedes the snapshot in the Runtime pipeline;
      // this fixture proves storage only and therefore rejects execution.
      return failUnexpectedCall();
    },
  };
  const payloadEncoder: PayloadEncoder = {
    descriptor,
    encode() {
      // Encoding requires a validated protocol payload and cancellation context,
      // neither of which belongs to snapshot construction.
      return failUnexpectedCall();
    },
  };
  const successPayloadDecoder: PayloadDecoder = {
    descriptor,
    decode() {
      // Success decoding occurs only after a successful transport outcome; this
      // fixture must remain inert while its identity is retained.
      return failUnexpectedCall();
    },
  };
  const errorPayloadDecoder: PayloadDecoder = {
    descriptor,
    decode() {
      // Error decoding is independently selected but likewise cannot run during
      // immutable snapshot assembly or inspection.
      return failUnexpectedCall();
    },
  };
  const transport: Transport = {
    descriptor,
    send() {
      // Network I/O is forbidden in this structural test; deterministic failure
      // protects the test from accidentally exercising the stored Transport.
      return failUnexpectedCall();
    },
  };
  const authorizationHandlerResolver: AuthorizationHandlerResolver = {
    descriptor,
    resolve() {
      // Actual Authorization is unavailable until after encoding, so Handler
      // selection remains a later Runtime action rather than snapshot behavior.
      return failUnexpectedCall();
    },
  };
  const integrationPlan: ModelIntegrationPlan = {
    source: "direct_adapter",
    taskProtocolAdapter,
    authorizationHandlers: [],
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
  const authorizationHandlers: readonly AuthorizationHandler[] = [];
  const capabilityResolution: CapabilityResolution = {
    satisfied: [],
    optionalUnsupported: [],
    diagnostics: [],
  };
  const snapshot: InteractionExecutionComponents = {
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
    authorizationHandlers,
    capabilityResolution,
  };

  // Every resolved value is retained directly so later Client or integration
  // changes cannot affect this interaction and selection is never repeated.
  expect(snapshot.integrationPlan).toBe(integrationPlan);
  expect(snapshot.componentSelection).toBe(componentSelection);
  expect(snapshot.resourceLimits).toBe(resourceLimits);
  expect(snapshot.taskProtocolAdapter).toBe(taskProtocolAdapter);
  expect(snapshot.serviceAccessResolver).toBe(serviceAccessResolver);
  expect(snapshot.payloadEncoder).toBe(payloadEncoder);
  expect(snapshot.successPayloadDecoder).toBe(successPayloadDecoder);
  expect(snapshot.errorPayloadDecoder).toBe(errorPayloadDecoder);
  expect(snapshot.transport).toBe(transport);
  expect(snapshot.authorizationHandlerResolver).toBe(authorizationHandlerResolver);
  expect(snapshot.authorizationHandlers).toBe(authorizationHandlers);
  expect(snapshot.capabilityResolution).toBe(capabilityResolution);
});

it("prevents component replacement and handler candidate mutation", () => {
  const proveReadonly = (
    snapshot: InteractionExecutionComponents,
    transport: Transport,
    handler: AuthorizationHandler,
  ): void => {
    // This compile-only helper proves an in-flight request cannot swap a selected
    // component or mutate the fixed authorization candidate membership.
    // @ts-expect-error The selected Transport cannot be replaced after validation.
    snapshot.transport = transport;
    // @ts-expect-error Handler candidate membership cannot change during execution.
    snapshot.authorizationHandlers.push(handler);
  };

  expectTypeOf(proveReadonly).toBeFunction();
});

it("does not expose configuration optionality or unsupported execution families", () => {
  // Configuration-layer resolvers and unimplemented execution paths remain
  // outside the finalized component snapshot.
  expectTypeOf<InteractionExecutionComponents>().not.toHaveProperty("modelIntegrationResolver");
  expectTypeOf<InteractionExecutionComponents>().not.toHaveProperty("streamingTransport");
  expectTypeOf<InteractionExecutionComponents>().not.toHaveProperty("streamFramer");
  expectTypeOf<InteractionExecutionComponents>().not.toHaveProperty("artifactResolver");
  expectTypeOf<InteractionExecutionComponents>().not.toHaveProperty("operationProtocolAdapter");
});

/** Fails if an inert component fixture is invoked by the structural snapshot test. */
function failUnexpectedCall(): never {
  // A standard classified error keeps any accidental boundary execution visible
  // without performing I/O, resolving credentials, or fabricating return data.
  throw new ModelInteractionError({
    message: "Execution component fixture was invoked unexpectedly.",
    category: "invalid_component_configuration",
    phase: "resolution",
    code: "unexpected_execution_component_invocation",
    diagnostics: [],
  });
}
