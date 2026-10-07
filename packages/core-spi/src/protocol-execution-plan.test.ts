// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type { ComponentTypeContract } from "./component-type-contract.js";
import type { DecoderSelection } from "./decoder-selection.js";
import type { EncoderSelection } from "./encoder-selection.js";
import type { PlannedComponentSelection } from "./planned-component-selection.js";
import type { ProtocolExecutionPlan } from "./protocol-execution-plan.js";
import type { TransportRequestPlan } from "./transport-request-plan.js";
import type { TransportSelection } from "./transport-selection.js";

it("defines only immutable protocol execution requirements", () => {
  // Exact equality prevents resolved instances, payload bytes, responses, and
  // unsupported feature placeholders from entering the protocol plan.
  expectTypeOf<ProtocolExecutionPlan>().toEqualTypeOf<{
    readonly transportPlan: TransportRequestPlan;
    readonly payloadEncoder: EncoderSelection;
    readonly successDecoder: DecoderSelection;
    readonly errorDecoder: DecoderSelection;
    readonly transport: TransportSelection;
    readonly modeComponents: readonly PlannedComponentSelection[];
    readonly typeContract: ComponentTypeContract;
    readonly extensions: Readonly<Record<string, unknown>>;
  }>();
});

it("preserves request encoder decoder transport and type requirements", () => {
  const transportPlan: TransportRequestPlan = {
    endpoint: { kind: "absolute", value: "https://models.example.test" },
    path: "/v1/chat/completions",
    method: "POST",
    headers: [],
    query: [],
    authorization: { kind: "authorization.bearer" },
    transportExtensions: {},
  };
  const payloadEncoder: EncoderSelection = {
    mediaType: { type: "application", subtype: "json", parameters: {} },
    schemaId: "schema://openai/chat-request",
  };
  const successDecoder: DecoderSelection = {
    mediaType: { type: "application", subtype: "json", parameters: {} },
    schemaId: "schema://openai/chat-response",
  };
  const errorDecoder: DecoderSelection = {
    mediaType: { type: "application", subtype: "json", parameters: {} },
    schemaId: "schema://openai/error-response",
  };
  const transport: TransportSelection = {
    transportKind: "transport.http",
    requiredCapabilities: new Set(["transport.fetch"]),
  };
  const typeContract: ComponentTypeContract = {
    inputTypeId: "protocol.openai.chat-request",
    inputSchemaId: "schema://openai/chat-request",
    outputTypeId: "protocol.openai.chat-response",
    outputSchemaId: "schema://openai/chat-response",
  };
  const extensions = { dialect: "openai-compatible" } as const;
  const plan: ProtocolExecutionPlan = {
    transportPlan,
    payloadEncoder,
    successDecoder,
    errorDecoder,
    transport,
    modeComponents: [],
    typeContract,
    extensions,
  };

  // Every completed planning value retains identity; the carrier does not
  // normalize media types, merge decoder paths, or resolve component instances.
  expect(plan.transportPlan).toBe(transportPlan);
  expect(plan.payloadEncoder).toBe(payloadEncoder);
  expect(plan.successDecoder).toBe(successDecoder);
  expect(plan.errorDecoder).toBe(errorDecoder);
  expect(plan.transport).toBe(transport);
  expect(plan.typeContract).toBe(typeContract);
  expect(plan.extensions).toBe(extensions);
});

it("keeps success and error decoder criteria independent", () => {
  const successDecoder: DecoderSelection = {
    mediaType: { type: "application", subtype: "json", parameters: {} },
    schemaId: "schema://service/success",
  };
  const errorDecoder: DecoderSelection = {
    mediaType: { type: "application", subtype: "problem+json", parameters: {} },
    schemaId: "schema://service/error",
  };
  const plan: ProtocolExecutionPlan = {
    transportPlan: {
      endpoint: { kind: "absolute", value: "https://models.example.test" },
      path: "/generate",
      method: "POST",
      headers: [],
      query: [],
      authorization: { kind: "authorization.none" },
      transportExtensions: {},
    },
    payloadEncoder: {},
    successDecoder,
    errorDecoder,
    transport: { requiredCapabilities: new Set() },
    modeComponents: [],
    typeContract: {},
    extensions: {},
  };

  // Outcome selects between two values already fixed before sending; actual
  // response Content-Type cannot replace either decoder after network I/O.
  expect(plan.successDecoder).toBe(successDecoder);
  expect(plan.errorDecoder).toBe(errorDecoder);
  expect(plan.successDecoder.schemaId).not.toBe(plan.errorDecoder.schemaId);
});

it("preserves ordered mode-specific component requirements", () => {
  const framer: PlannedComponentSelection = {
    role: { id: "stream.framer" },
    required: true,
    requiredCapabilities: new Set(["stream.sse"]),
  };
  const mapper: PlannedComponentSelection = {
    role: { id: "stream.event-mapper" },
    required: false,
    requiredCapabilities: new Set(),
  };
  const modeComponents = [framer, mapper] as const;
  const plan: ProtocolExecutionPlan = {
    transportPlan: {
      endpoint: { kind: "absolute", value: "https://models.example.test" },
      path: "/stream",
      method: "POST",
      headers: [],
      query: [],
      authorization: { kind: "authorization.none" },
      transportExtensions: {},
    },
    payloadEncoder: {},
    successDecoder: {},
    errorDecoder: {},
    transport: { requiredCapabilities: new Set() },
    modeComponents,
    typeContract: {},
    extensions: {},
  };

  // Mode requirements remain declarative and ordered. The current Runtime may
  // reject unsupported roles before I/O without changing this open plan value.
  expect(plan.modeComponents).toBe(modeComponents);
  expect(plan.modeComponents).toEqual([framer, mapper]);
  expect(plan.modeComponents[0]).toBe(framer);
  expect(plan.modeComponents[1]).toBe(mapper);
});

it("prevents replacement or collection membership mutation", () => {
  const proveReadonly = (
    plan: ProtocolExecutionPlan,
    transportPlan: TransportRequestPlan,
    component: PlannedComponentSelection,
  ): void => {
    // This compile-only helper locks composed planning values, mode membership,
    // and extension membership without changing a runtime fixture.
    // @ts-expect-error The transport request plan cannot be replaced.
    plan.transportPlan = transportPlan;
    // @ts-expect-error Decoder criteria cannot be replaced.
    plan.errorDecoder = {};
    // @ts-expect-error Mode component membership cannot be extended.
    plan.modeComponents.push(component);
    // @ts-expect-error Type contracts cannot be replaced.
    plan.typeContract = {};
    // @ts-expect-error Extension membership cannot be rewritten.
    plan.extensions.example = true;
  };

  expectTypeOf(proveReadonly).toBeFunction();
});

it("does not contain resolved state payloads responses or unsupported plans", () => {
  // These values belong to later selection/execution stages or feature work and
  // must not appear as inert placeholders in the initial Web protocol plan.
  expectTypeOf<ProtocolExecutionPlan>().not.toHaveProperty("components");
  expectTypeOf<ProtocolExecutionPlan>().not.toHaveProperty("payload");
  expectTypeOf<ProtocolExecutionPlan>().not.toHaveProperty("body");
  expectTypeOf<ProtocolExecutionPlan>().not.toHaveProperty("response");
  expectTypeOf<ProtocolExecutionPlan>().not.toHaveProperty("artifactResolutionPlan");
  expectTypeOf<ProtocolExecutionPlan>().not.toHaveProperty("bodySigningRequirement");
  expectTypeOf<ProtocolExecutionPlan>().not.toHaveProperty("capabilityRequirements");
  expectTypeOf<ProtocolExecutionPlan>().not.toHaveProperty("resolve");
});
