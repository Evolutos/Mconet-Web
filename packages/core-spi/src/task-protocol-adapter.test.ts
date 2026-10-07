// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it, vi } from "vitest";

import {
  ModelInteractionError,
  type CompatibilityPolicy,
  type InteractionMode,
  type ModelRequest,
  type ModelTarget,
  type ParsedTaskResponse,
  type ProcessingResult,
  type TaskDescriptor,
} from "@evolutos/mconet-core-domain";

import type { ErasedRuntimeValue } from "./erased-runtime-value.js";
import type { ProtocolExecutionPlan } from "./protocol-execution-plan.js";
import type { ProtocolRequestPlan } from "./protocol-request-plan.js";
import type { RuntimeComponent } from "./runtime-component.js";
import type { TaskProtocolAdapter } from "./task-protocol-adapter.js";
import type { TransportResponseMetadata } from "./transport-response-metadata.js";

it("defines the exact synchronous task protocol boundary", () => {
  // RuntimeComponent contributes only immutable descriptor metadata. Exact
  // signatures keep each adapter responsibility labelled and non-overlapping.
  expectTypeOf<TaskProtocolAdapter>().toMatchTypeOf<RuntimeComponent>();
  expectTypeOf<TaskProtocolAdapter["supports"]>().toEqualTypeOf<
    (input: {
      readonly target: ModelTarget;
      readonly task: TaskDescriptor;
      readonly mode: InteractionMode;
    }) => boolean
  >();
  expectTypeOf<TaskProtocolAdapter["preparePlan"]>().toEqualTypeOf<
    (input: {
      readonly request: ModelRequest;
      readonly mode: InteractionMode;
      readonly policy: CompatibilityPolicy;
    }) => ProcessingResult<ProtocolExecutionPlan>
  >();
  expectTypeOf<TaskProtocolAdapter["buildRequest"]>().toEqualTypeOf<
    (input: {
      readonly request: ModelRequest;
      readonly plan: ProtocolExecutionPlan;
    }) => ProcessingResult<ProtocolRequestPlan>
  >();
  expectTypeOf<TaskProtocolAdapter["parseResponse"]>().toEqualTypeOf<
    (input: {
      readonly payload: ErasedRuntimeValue;
      readonly metadata: TransportResponseMetadata;
    }) => ProcessingResult<ParsedTaskResponse>
  >();
  expectTypeOf<TaskProtocolAdapter["parseError"]>().toEqualTypeOf<
    (input: {
      readonly payload: ErasedRuntimeValue;
      readonly metadata: TransportResponseMetadata;
    }) => ModelInteractionError
  >();
});

it("forwards every protocol stage input and preserves configured result identities", () => {
  const target: ModelTarget = {
    serviceId: "service.example",
    protocolId: "protocol.example",
    model: { name: "model-example", metadata: {}, extensions: {} },
    extensions: {},
  };
  const task: TaskDescriptor = {
    type: "conversation.generate",
    metadata: {},
    extensions: {},
  };
  const mode: InteractionMode = { id: "unary" };
  const policy: CompatibilityPolicy = { mode: "compatible" };
  const request: ModelRequest = {
    target,
    task: {
      descriptor: task,
      document: {
        version: "1.0",
        root: {
          id: "request-root",
          kind: "task.root",
          composition: "container",
          children: [],
          relations: [],
          metadata: {},
          extensions: {},
        },
        metadata: {},
        extensions: {},
      },
      artifacts: { artifacts: [] },
      metadata: {},
      extensions: {},
    },
    metadata: {},
    extensions: {},
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
    transport: { transportKind: "transport.http", requiredCapabilities: new Set() },
    modeComponents: [],
    typeContract: {
      inputTypeId: "protocol.example.request",
      outputTypeId: "protocol.example.response",
    },
    extensions: {},
  };
  const payload: ErasedRuntimeValue = {
    typeId: "protocol.example.request",
    schemaId: "schema://protocol.example/request/1",
    value: { model: "model-example", messages: [] },
  };
  const protocolRequest: ProtocolRequestPlan = { payload, executionPlan };
  const metadata: TransportResponseMetadata = {
    outcome: "success",
    headers: [],
    statusCode: 200,
    mediaType: { type: "application", subtype: "json", parameters: {} },
    extensions: {},
  };
  const parsedResponse: ParsedTaskResponse = {
    result: {
      descriptor: task,
      document: {
        version: "1.0",
        root: {
          id: "response-root",
          kind: "task.root",
          composition: "container",
          children: [],
          relations: [],
          metadata: {},
          extensions: {},
        },
        metadata: {},
        extensions: {},
      },
      artifacts: { artifacts: [] },
      metadata: {},
      extensions: {},
    },
    status: "completed",
    protocolState: [],
    extensions: {},
  };
  const planned: ProcessingResult<ProtocolExecutionPlan> = {
    value: executionPlan,
    diagnostics: [],
  };
  const built: ProcessingResult<ProtocolRequestPlan> = {
    value: protocolRequest,
    diagnostics: [],
  };
  const parsed: ProcessingResult<ParsedTaskResponse> = {
    value: parsedResponse,
    diagnostics: [],
  };
  const serviceError = new ModelInteractionError({
    message: "The model service rejected the request.",
    category: "model_service",
    phase: "response_parsing",
    code: "service_request_rejected",
    diagnostics: [],
  });
  const supports = vi.fn((): boolean => {
    // This fixture accepts the configured tuple directly; concrete integration
    // matching rules belong to the adapter implementation under contract test.
    return true;
  });
  const preparePlan = vi.fn((): ProcessingResult<ProtocolExecutionPlan> => {
    // Return the configured planning result directly; a concrete adapter owns
    // protocol matching and deterministic plan construction.
    return planned;
  });
  const buildRequest = vi.fn((): ProcessingResult<ProtocolRequestPlan> => {
    // Return the unencoded payload and original execution requirements without
    // duplicating protocol serialization inside this SPI contract test.
    return built;
  });
  const parseResponse = vi.fn((): ProcessingResult<ParsedTaskResponse> => {
    // Return parsed protocol facts directly; Runtime remains responsible for
    // adding request identity, diagnostics, and the public output envelope.
    return parsed;
  });
  const parseError = vi.fn((): ModelInteractionError => {
    // Preserve the adapter's classified service error without wrapping it or
    // replacing its structured category, phase, or stable code.
    return serviceError;
  });
  const adapter: TaskProtocolAdapter = {
    descriptor: {
      name: "fixture-task-protocol-adapter",
      version: "1.0.0",
      capabilities: new Set(),
      source: "plugin",
    },
    supports,
    preparePlan,
    buildRequest,
    parseResponse,
    parseError,
  };
  const supportInput = { target, task, mode } as const;
  const planInput = { request, mode, policy } as const;
  const buildInput = { request, plan: executionPlan } as const;
  const parseInput = { payload, metadata } as const;

  // Identity assertions prove the interface forwards complete labelled inputs
  // and does not insert resolution, encoding, transport, or output assembly.
  expect(adapter.supports(supportInput)).toBe(true);
  expect(adapter.preparePlan(planInput)).toBe(planned);
  expect(adapter.buildRequest(buildInput)).toBe(built);
  expect(adapter.parseResponse(parseInput)).toBe(parsed);
  expect(adapter.parseError(parseInput)).toBe(serviceError);
  expect(supports).toHaveBeenCalledWith(supportInput);
  expect(preparePlan).toHaveBeenCalledWith(planInput);
  expect(buildRequest).toHaveBeenCalledWith(buildInput);
  expect(parseResponse).toHaveBeenCalledWith(parseInput);
  expect(parseError).toHaveBeenCalledWith(parseInput);
});

it("does not expose artifact resolution encoding authorization transport or output assembly", () => {
  // The current Web range validates an empty Artifact Catalog before adapter
  // execution; unsupported Artifact execution is not represented by a placeholder.
  expectTypeOf<Parameters<TaskProtocolAdapter["buildRequest"]>[0]>().not.toHaveProperty(
    "resolvedArtifacts",
  );
  expectTypeOf<TaskProtocolAdapter>().not.toHaveProperty("resolveArtifacts");
  expectTypeOf<TaskProtocolAdapter>().not.toHaveProperty("encode");
  expectTypeOf<TaskProtocolAdapter>().not.toHaveProperty("getCredential");
  expectTypeOf<TaskProtocolAdapter>().not.toHaveProperty("applyAuthorization");
  expectTypeOf<TaskProtocolAdapter>().not.toHaveProperty("send");
  expectTypeOf<TaskProtocolAdapter>().not.toHaveProperty("createModelOutput");
});
