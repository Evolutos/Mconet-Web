// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type { ErasedRuntimeValue } from "./erased-runtime-value.js";
import type { ProtocolExecutionPlan } from "./protocol-execution-plan.js";
import type { ProtocolRequestPlan } from "./protocol-request-plan.js";

it("defines only an erased payload and its immutable execution plan", () => {
  // Exact equality keeps transport bytes, authorization state, and component
  // instances outside the adapter output while requiring both pipeline inputs.
  expectTypeOf<ProtocolRequestPlan>().toEqualTypeOf<{
    readonly payload: ErasedRuntimeValue;
    readonly executionPlan: ProtocolExecutionPlan;
  }>();
});

it("preserves payload and execution plan identities without encoding", () => {
  const nativePayload = { model: "mconet-model", messages: [{ role: "user", content: "Hello" }] };
  const payload: ErasedRuntimeValue = {
    typeId: "protocol.example.request",
    schemaId: "schema://protocol.example/request/1",
    value: nativePayload,
  };
  const executionPlan: ProtocolExecutionPlan = {
    transportPlan: {
      endpoint: { kind: "absolute", value: "https://models.example.test" },
      path: "/v1/messages",
      method: "POST",
      headers: [{ name: "content-type", value: "application/json" }],
      query: [],
      authorization: { kind: "authorization.bearer" },
      transportExtensions: {},
    },
    payloadEncoder: {
      mediaType: { type: "application", subtype: "json", parameters: {} },
      schemaId: "schema://protocol.example/request/1",
    },
    successDecoder: {
      mediaType: { type: "application", subtype: "json", parameters: {} },
      schemaId: "schema://protocol.example/response/1",
    },
    errorDecoder: {
      mediaType: { type: "application", subtype: "problem+json", parameters: {} },
      schemaId: "schema://protocol.example/error/1",
    },
    transport: {
      transportKind: "transport.http",
      requiredCapabilities: new Set(["transport.fetch"]),
    },
    modeComponents: [],
    typeContract: {
      inputTypeId: "protocol.example.request",
      inputSchemaId: "schema://protocol.example/request/1",
      outputTypeId: "protocol.example.response",
      outputSchemaId: "schema://protocol.example/response/1",
    },
    extensions: {},
  };
  const requestPlan: ProtocolRequestPlan = { payload, executionPlan };

  // Identity checks prove this structural carrier does not clone, normalize,
  // encode, or otherwise reinterpret either completed protocol-owned value.
  expect(requestPlan.payload).toBe(payload);
  expect(requestPlan.payload.value).toBe(nativePayload);
  expect(requestPlan.executionPlan).toBe(executionPlan);
});

it("prevents replacement of the payload or execution requirements", () => {
  const proveReadonly = (
    requestPlan: ProtocolRequestPlan,
    payload: ErasedRuntimeValue,
    executionPlan: ProtocolExecutionPlan,
  ): void => {
    // This compile-only helper verifies the adapter result stays bound to the
    // same mapped payload and previously validated plan throughout execution.
    // @ts-expect-error The mapped payload cannot be replaced after planning.
    requestPlan.payload = payload;
    // @ts-expect-error The execution requirements cannot be replaced after validation.
    requestPlan.executionPlan = executionPlan;
  };

  expectTypeOf(proveReadonly).toBeFunction();
});

it("does not contain encoded authorized or executed request state", () => {
  // Encoding, authorization, transport, and response processing are later
  // pipeline stages and must not be represented by inert fields or methods.
  expectTypeOf<ProtocolRequestPlan>().not.toHaveProperty("body");
  expectTypeOf<ProtocolRequestPlan>().not.toHaveProperty("bytes");
  expectTypeOf<ProtocolRequestPlan>().not.toHaveProperty("request");
  expectTypeOf<ProtocolRequestPlan>().not.toHaveProperty("authorization");
  expectTypeOf<ProtocolRequestPlan>().not.toHaveProperty("response");
  expectTypeOf<ProtocolRequestPlan>().not.toHaveProperty("encode");
  expectTypeOf<ProtocolRequestPlan>().not.toHaveProperty("send");
});
