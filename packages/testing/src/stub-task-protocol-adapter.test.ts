// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it, vi } from "vitest";

import {
  ModelInteractionError,
  type CompatibilityPolicy,
  type Diagnostic,
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
  TaskProtocolAdapter,
  TransportResponseMetadata,
} from "@evolutos/mconet-core-spi";

import { StubTaskProtocolAdapter } from "./stub-task-protocol-adapter.js";

/** Stable target used by every adapter method fixture. */
const target: ModelTarget = {
  serviceId: "service.example",
  protocolId: "protocol.example",
  model: { name: "model-example", metadata: {}, extensions: {} },
  extensions: {},
};

/** Stable task descriptor used by matching and request fixtures. */
const task: TaskDescriptor = {
  type: "conversation.generate",
  metadata: {},
  extensions: {},
};

/** Unary mode supplied to matching and planning handlers. */
const mode: InteractionMode = { id: "unary" };

/** Compatibility policy supplied to plan preparation. */
const policy: CompatibilityPolicy = { mode: "compatible" };

/** Complete request used to prove identity-preserving forwarding. */
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

/** Structurally complete protocol execution plan returned by the success handler. */
const executionPlan: ProtocolExecutionPlan = {
  transportPlan: {
    endpoint: { kind: "absolute", value: "https://models.example.test" },
    path: "/v1/messages",
    method: "POST",
    headers: [],
    query: [],
    authorization: { kind: "authorization.none" },
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

/** Erased protocol payload shared by request and response parsing fixtures. */
const payload: ErasedRuntimeValue = {
  typeId: "protocol.example.request",
  schemaId: "schema://protocol.example/request/1",
  value: { model: "model-example", messages: [] },
};

/** Successful request-plan result returned without cloning. */
const protocolRequest: ProtocolRequestPlan = { payload, executionPlan };

/** Transport evidence supplied to both response parsing methods. */
const metadata: TransportResponseMetadata = {
  outcome: "success",
  headers: [],
  statusCode: 200,
  mediaType: { type: "application", subtype: "json", parameters: {} },
  extensions: {},
};

/** Parsed task response returned by the success parsing handler. */
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

/** Successful configured results preserved by reference. */
const prepared: ProcessingResult<ProtocolExecutionPlan> = { value: executionPlan, diagnostics: [] };
const built: ProcessingResult<ProtocolRequestPlan> = { value: protocolRequest, diagnostics: [] };
const parsed: ProcessingResult<ParsedTaskResponse> = { value: parsedResponse, diagnostics: [] };

/** Classified service failure returned by parseError. */
const serviceError = new ModelInteractionError({
  message: "The model service rejected the request.",
  category: "model_service",
  phase: "response_parsing",
  code: "service_request_rejected",
  diagnostics: [],
});

/** Stable component metadata retained by every stub fixture. */
const descriptor: TaskProtocolAdapter["descriptor"] = {
  name: "stub-task-protocol-adapter",
  version: "1.0.0",
  capabilities: new Set(),
  source: "application",
};

/** Exact inputs whose identity must reach configured handlers. */
const supportInput = { target, task, mode } as const;
const planInput = { request, mode, policy } as const;
const buildInput = { request, plan: executionPlan } as const;
const parseInput = { payload, metadata } as const;

/**
 * Creates one stub with successful defaults and optional per-method overrides.
 *
 * @param overrides Handler replacements needed by the current test.
 * @returns Fresh independent adapter stub.
 */
function createStub(
  overrides: Partial<ConstructorParameters<typeof StubTaskProtocolAdapter>[0]> = {},
): StubTaskProtocolAdapter {
  // Apply overrides after complete typed defaults so each test changes only the
  // behavior under examination while every other SPI method remains callable.
  return new StubTaskProtocolAdapter({
    descriptor,
    supports: () => true,
    preparePlan: () => prepared,
    buildRequest: () => built,
    parseResponse: () => parsed,
    parseError: () => serviceError,
    ...overrides,
  });
}

it("forwards every method input and preserves configured success identities", () => {
  const supports = vi.fn(() => true);
  const preparePlan = vi.fn(() => prepared);
  const buildRequest = vi.fn(() => built);
  const parseResponse = vi.fn(() => parsed);
  const parseError = vi.fn(() => serviceError);
  const stub = new StubTaskProtocolAdapter({
    descriptor,
    supports,
    preparePlan,
    buildRequest,
    parseResponse,
    parseError,
  });

  // Each method delegates exactly once with the original labelled input and
  // returns the handler result without cloning or normalization.
  expect(stub.descriptor).toBe(descriptor);
  expect(stub.supports(supportInput)).toBe(true);
  expect(stub.preparePlan(planInput)).toBe(prepared);
  expect(stub.buildRequest(buildInput)).toBe(built);
  expect(stub.parseResponse(parseInput)).toBe(parsed);
  expect(stub.parseError(parseInput)).toBe(serviceError);
  expect(supports).toHaveBeenCalledExactlyOnceWith(supportInput);
  expect(preparePlan).toHaveBeenCalledExactlyOnceWith(planInput);
  expect(buildRequest).toHaveBeenCalledExactlyOnceWith(buildInput);
  expect(parseResponse).toHaveBeenCalledExactlyOnceWith(parseInput);
  expect(parseError).toHaveBeenCalledExactlyOnceWith(parseInput);
});

it("returns a configured unusable plan result without inventing a value", () => {
  const diagnostic: Diagnostic = {
    code: "fixture_invalid_plan",
    severity: "error",
    phase: "planning",
    message: "The configured Fixture plan is unusable.",
  };
  const unusablePlan: ProcessingResult<ProtocolExecutionPlan> = {
    diagnostics: [diagnostic],
  };
  const stub = createStub({ preparePlan: () => unusablePlan });

  // ProcessingResult represents an invalid or unavailable plan without an unsafe
  // structurally malformed cast; the stub preserves absence and diagnostics.
  expect(stub.preparePlan(planInput)).toBe(unusablePlan);
  expect(Object.hasOwn(unusablePlan, "value")).toBe(false);
  expect(unusablePlan.diagnostics).toEqual([diagnostic]);
});

it("propagates an independently configured failure from every adapter method", () => {
  const failures = {
    supports: new Error("supports failure"),
    preparePlan: new Error("prepare plan failure"),
    buildRequest: new Error("build request failure"),
    parseResponse: new Error("parse response failure"),
    parseError: new Error("parse error failure"),
  } as const;

  // Each stub changes exactly one handler. Other method configurations neither
  // intercept nor translate the thrown identity under examination.
  expect(() =>
    createStub({
      supports: () => {
        throw failures.supports;
      },
    }).supports(supportInput),
  ).toThrow(failures.supports);
  expect(() =>
    createStub({
      preparePlan: () => {
        throw failures.preparePlan;
      },
    }).preparePlan(planInput),
  ).toThrow(failures.preparePlan);
  expect(() =>
    createStub({
      buildRequest: () => {
        throw failures.buildRequest;
      },
    }).buildRequest(buildInput),
  ).toThrow(failures.buildRequest);
  expect(() =>
    createStub({
      parseResponse: () => {
        throw failures.parseResponse;
      },
    }).parseResponse(parseInput),
  ).toThrow(failures.parseResponse);
  expect(() =>
    createStub({
      parseError: () => {
        throw failures.parseError;
      },
    }).parseError(parseInput),
  ).toThrow(failures.parseError);
});

it("captures handler references when the stub is constructed", () => {
  const originalSupports = vi.fn(() => true);
  const configuration = {
    descriptor,
    supports: originalSupports,
    preparePlan: () => prepared,
    buildRequest: () => built,
    parseResponse: () => parsed,
    parseError: () => serviceError,
  };
  const stub = new StubTaskProtocolAdapter(configuration);
  configuration.supports = () => false;

  // Copying the function reference once keeps behavior stable even if mutable
  // JavaScript fixture configuration is edited after construction.
  expect(stub.supports(supportInput)).toBe(true);
  expect(originalSupports).toHaveBeenCalledExactlyOnceWith(supportInput);
});

it("implements only the TaskProtocolAdapter surface", () => {
  // Exact method types prove the stub can replace an adapter without exposing
  // configuration setters, call logs, transport, encoding, or assertion helpers.
  expectTypeOf<StubTaskProtocolAdapter>().toMatchTypeOf<TaskProtocolAdapter>();
  expectTypeOf<StubTaskProtocolAdapter["supports"]>().toEqualTypeOf<
    TaskProtocolAdapter["supports"]
  >();
  expectTypeOf<StubTaskProtocolAdapter["preparePlan"]>().toEqualTypeOf<
    TaskProtocolAdapter["preparePlan"]
  >();
  expectTypeOf<StubTaskProtocolAdapter["buildRequest"]>().toEqualTypeOf<
    TaskProtocolAdapter["buildRequest"]
  >();
  expectTypeOf<StubTaskProtocolAdapter["parseResponse"]>().toEqualTypeOf<
    TaskProtocolAdapter["parseResponse"]
  >();
  expectTypeOf<StubTaskProtocolAdapter["parseError"]>().toEqualTypeOf<
    TaskProtocolAdapter["parseError"]
  >();
  expectTypeOf<StubTaskProtocolAdapter>().not.toHaveProperty("setResult");
  expectTypeOf<StubTaskProtocolAdapter>().not.toHaveProperty("calls");
  expectTypeOf<StubTaskProtocolAdapter>().not.toHaveProperty("send");
});
