// Copyright © 2026 Mcont.

import type { ResolvedInteractionResourceLimits } from "@evolutos/mconet-core-domain";
import type {
  AuthorizationHandler,
  CapabilityResolution,
  ComponentDescriptor,
  InteractionExecutionComponents,
  Transport,
} from "@evolutos/mconet-core-spi";
import { expect, it } from "vitest";

import { freezeExecutionSnapshot } from "./freeze-execution-snapshot.js";

it("freezes the snapshot and keeps it stable while the source handler list changes", () => {
  const descriptor: ComponentDescriptor = {
    name: "execution-fixture",
    version: "1.0.0",
    capabilities: new Set(),
    source: "application",
  };
  const calls: string[] = [];
  const fail = (name: string) => (): never => {
    calls.push(name);
    throw new Error(name);
  };
  const handler: AuthorizationHandler = {
    descriptor,
    supports: fail("supports"),
    apply: fail("apply"),
  };
  const handlers = [handler];
  const transport: Transport = { descriptor, send: fail("send") };
  const resourceLimits: ResolvedInteractionResourceLimits = {
    maxResponseBodyBytes: 1,
    maxStreamingErrorBodyBytes: 1,
    maxFrameBytes: 1,
  };
  const capabilityResolution: CapabilityResolution = {
    satisfied: [],
    optionalUnsupported: [],
    diagnostics: [],
  };
  const input: InteractionExecutionComponents = {
    integrationPlan: {
      source: "direct_adapter",
      taskProtocolAdapter: {
        descriptor,
        supports: fail("supports"),
        preparePlan: fail("preparePlan"),
        buildRequest: fail("buildRequest"),
        parseResponse: fail("parseResponse"),
        parseError: fail("parseError"),
      },
      authorizationHandlers: handlers,
      payloadEncoders: [],
      payloadDecoders: [],
      transports: [],
      extensions: {},
    },
    componentSelection: { components: [] },
    resourceLimits,
    taskProtocolAdapter: {
      descriptor,
      supports: fail("supports"),
      preparePlan: fail("preparePlan"),
      buildRequest: fail("buildRequest"),
      parseResponse: fail("parseResponse"),
      parseError: fail("parseError"),
    },
    serviceAccessResolver: { descriptor, resolve: fail("resolve") },
    payloadEncoder: { descriptor, encode: fail("encode") },
    successPayloadDecoder: { descriptor, decode: fail("decode") },
    errorPayloadDecoder: { descriptor, decode: fail("decode") },
    transport,
    authorizationHandlerResolver: { descriptor, resolve: fail("resolve") },
    authorizationHandlers: handlers,
    capabilityResolution,
  };

  const snapshot = freezeExecutionSnapshot(input);
  handlers.push(handler);

  expect(Object.isFrozen(snapshot)).toBe(true);
  expect(Object.isFrozen(snapshot.authorizationHandlers)).toBe(true);
  expect(snapshot.authorizationHandlers).toEqual([handler]);
  expect(snapshot.transport).toBe(transport);
  expect(() => {
    (snapshot as { transport: Transport }).transport = transport;
  }).toThrow(TypeError);
  expect(calls).toEqual([]);
});
