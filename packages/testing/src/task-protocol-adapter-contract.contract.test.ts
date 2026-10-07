// Copyright © 2026 Mcont.

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

import type {
  ErasedRuntimeValue,
  ProtocolExecutionPlan,
  ProtocolRequestPlan,
  TransportResponseMetadata,
} from "@evolutos/mconet-core-spi";

import { StubTaskProtocolAdapter } from "./stub-task-protocol-adapter.js";
import { defineTaskProtocolAdapterContract } from "./task-protocol-adapter-contract.js";

/** Registers the shared suite against a fully deterministic compliant adapter. */
defineTaskProtocolAdapterContract("StubTaskProtocolAdapter", () => {
  // Each contract case receives fresh domain inputs and outputs so a mutation in
  // one case cannot be hidden by state retained from another case.
  const target: ModelTarget = {
    serviceId: "service.contract",
    protocolId: "protocol.contract",
    model: { name: "model-contract", metadata: {}, extensions: {} },
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
      schemaId: "schema://protocol.contract/request/1",
    },
    successDecoder: {
      mediaType: { type: "application", subtype: "json", parameters: {} },
      schemaId: "schema://protocol.contract/response/1",
    },
    errorDecoder: {
      mediaType: { type: "application", subtype: "problem+json", parameters: {} },
      schemaId: "schema://protocol.contract/error/1",
    },
    transport: {
      transportKind: "transport.http",
      requiredCapabilities: new Set(["transport.unary"]),
    },
    modeComponents: [],
    typeContract: {
      inputTypeId: "protocol.contract.request",
      outputTypeId: "protocol.contract.response",
    },
    extensions: {},
  };
  const requestPayload: ErasedRuntimeValue = {
    typeId: "protocol.contract.request",
    schemaId: "schema://protocol.contract/request/1",
    value: { messages: [] },
  };
  const responsePayload: ErasedRuntimeValue = {
    typeId: "protocol.contract.response",
    schemaId: "schema://protocol.contract/response/1",
    value: { choices: [] },
  };
  const errorPayload: ErasedRuntimeValue = {
    typeId: "protocol.contract.error",
    schemaId: "schema://protocol.contract/error/1",
    value: { code: "rejected" },
  };
  const successMetadata: TransportResponseMetadata = {
    outcome: "success",
    statusCode: 200,
    headers: [],
    mediaType: { type: "application", subtype: "json", parameters: {} },
    extensions: {},
  };
  const errorMetadata: TransportResponseMetadata = {
    outcome: "service_error",
    statusCode: 400,
    headers: [],
    mediaType: { type: "application", subtype: "problem+json", parameters: {} },
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
  const protocolRequest: ProtocolRequestPlan = {
    payload: requestPayload,
    executionPlan,
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
    message: "The contract service rejected the request.",
    category: "model_service",
    phase: "response_parsing",
    code: "contract_service_rejected",
    diagnostics: [],
  });
  const adapter = new StubTaskProtocolAdapter({
    descriptor: {
      name: "contract-task-protocol-adapter",
      version: "1.0.0",
      capabilities: new Set(),
      source: "application",
    },
    supports: () => true,
    preparePlan: () => planned,
    buildRequest: () => built,
    parseResponse: () => parsed,
    parseError: () => serviceError,
  });

  // Expected values stay implementation-owned; the suite compares normalized
  // structure rather than requiring adapters to reuse fixture object identities.
  return {
    adapter,
    support: { input: { target, task, mode }, expected: true },
    plan: { input: { request, mode, policy }, expected: planned },
    request: { input: { request, plan: executionPlan }, expected: built },
    response: {
      input: { payload: responsePayload, metadata: successMetadata },
      expected: parsed,
    },
    error: {
      input: { payload: errorPayload, metadata: errorMetadata },
      expected: serviceError,
    },
  };
});
