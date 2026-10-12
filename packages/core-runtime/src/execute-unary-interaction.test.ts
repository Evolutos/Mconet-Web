// Copyright © 2026 Mcont.

import type {
  ModelRequest,
  ParsedTaskResponse,
  ResolvedInteractionResourceLimits,
} from "@evolutos/mconet-core-domain";
import type {
  AuthorizationHandler,
  PayloadDecoder,
  PayloadEncoder,
  ProtocolExecutionPlan,
  TaskProtocolAdapter,
  TransportResponse,
} from "@evolutos/mconet-core-spi";
import { expect, it } from "vitest";

import { executeUnaryInteraction } from "./execute-unary-interaction.js";
import { createInteractionContext } from "./interaction-context.js";
import { MockTransport } from "../../testing/src/mock-transport.js";

const json = { type: "application", subtype: "json", parameters: {} } as const;
const requestType = "protocol.request";
const responseType = "protocol.response";
const bytesType = "codec.bytes";
const limits: ResolvedInteractionResourceLimits = {
  maxResponseBodyBytes: 1024,
  maxStreamingErrorBodyBytes: 256,
  maxFrameBytes: 128,
};

it("runs the success chain through MockTransport in pipeline order", async () => {
  const order: string[] = [];
  const request = createRequest();
  const plan = createPlan();
  const response: TransportResponse = {
    metadata: {
      outcome: "success",
      headers: [],
      extensions: {},
      mediaType: json,
    },
    body: new Uint8Array([7]),
  };
  const transport = new MockTransport({
    descriptor: {
      name: "mock-transport",
      version: "1.0.0",
      capabilities: new Set(),
      source: "application",
      typeContract: {
        inputTypeId: bytesType,
        outputTypeId: bytesType,
        outputMediaTypes: [json],
      },
    },
    response,
  });
  const originalSend = transport.send.bind(transport);
  transport.send = (transportRequest, context) => {
    order.push("transport.send");
    return originalSend(transportRequest, context);
  };

  const adapter: TaskProtocolAdapter = {
    descriptor: {
      name: "adapter",
      version: "1.0.0",
      capabilities: new Set(),
      source: "application",
    },
    supports: () => {
      order.push("adapter.supports");
      return true;
    },
    preparePlan: () => {
      order.push("adapter.preparePlan");
      return { diagnostics: [], value: plan };
    },
    buildRequest: () => {
      order.push("adapter.buildRequest");
      return {
        diagnostics: [],
        value: { payload: { typeId: requestType, value: { text: "hello" } }, executionPlan: plan },
      };
    },
    parseResponse: () => {
      order.push("adapter.parseResponse");
      return { diagnostics: [], value: createParsedResponse() };
    },
    parseError: () => {
      throw new Error("parseError");
    },
  };
  const encoder: PayloadEncoder = {
    descriptor: {
      name: "encoder",
      version: "1.0.0",
      capabilities: new Set(),
      source: "builtin",
      typeContract: { inputTypeId: requestType, outputTypeId: bytesType },
    },
    encode: async () => {
      order.push("encoder.encode");
      return { kind: "bytes", bytes: new Uint8Array([1]) };
    },
  };
  const decoder: PayloadDecoder = {
    descriptor: {
      name: "success-decoder",
      version: "1.0.0",
      capabilities: new Set(),
      source: "builtin",
      typeContract: {
        inputTypeId: bytesType,
        outputTypeId: responseType,
        inputMediaTypes: [json],
      },
    },
    decode: async () => {
      order.push("decoder.decode");
      return { typeId: responseType, value: { ok: true } };
    },
  };
  const errorDecoder: PayloadDecoder = {
    descriptor: {
      name: "error-decoder",
      version: "1.0.0",
      capabilities: new Set(),
      source: "builtin",
      typeContract: { inputTypeId: bytesType, outputTypeId: "protocol.error" },
    },
    decode: async () => {
      throw new Error("error decode");
    },
  };
  const handler: AuthorizationHandler = {
    descriptor: {
      name: "handler",
      version: "1.0.0",
      capabilities: new Set(),
      source: "builtin",
    },
    supports: () => {
      order.push("handler.supports");
      return true;
    },
    apply: async ({ request: authorizedRequest }) => {
      order.push("handler.apply");
      return {
        ...authorizedRequest,
        headers: [{ name: "authorization", value: "Bearer token" }],
      };
    },
  };

  const output = await executeUnaryInteraction({
    context: createInteractionContext({ request }),
    mode: { id: "unary" },
    clientConfiguration: {},
    sdkResourceLimits: limits,
    adapter,
    authorizationHandlers: [handler],
    payloadEncoder: { interactionComponent: encoder, integrationComponents: [] },
    successPayloadDecoder: { interactionComponent: decoder, integrationComponents: [] },
    errorPayloadDecoder: { interactionComponent: errorDecoder, integrationComponents: [] },
    transport: { interactionComponent: transport, integrationComponents: [] },
    monitors: [
      {
        descriptor: {
          name: "monitor",
          version: "1.0.0",
          capabilities: new Set(),
          source: "application",
        },
        onEvent: async (event) => {
          order.push(`monitor.${event.type}`);
        },
      },
    ],
    interactionId: "interaction-1",
    releaseResponse: () => {
      order.push("release.response");
    },
    releaseContext: () => {
      order.push("release.context");
    },
  });

  expect(output.status).toBe("completed");
  expect(output.target).toBe(request.target);
  expect(order).toEqual([
    "adapter.supports",
    "adapter.preparePlan",
    "adapter.buildRequest",
    "encoder.encode",
    "monitor.interaction.request.pre_authorization",
    "handler.supports",
    "handler.apply",
    "transport.send",
    "decoder.decode",
    "adapter.parseResponse",
    "monitor.interaction.completed",
    "release.response",
    "release.context",
  ]);
});

it("does not send when request validation fails", async () => {
  let sends = 0;
  const response: TransportResponse = {
    metadata: { outcome: "success", headers: [], extensions: {} },
    body: new Uint8Array(),
  };
  const transport = new MockTransport({
    descriptor: {
      name: "mock-transport",
      version: "1.0.0",
      capabilities: new Set(),
      source: "application",
    },
    response,
  });
  transport.send = () => {
    sends += 1;
    return Promise.resolve(response);
  };

  await expect(
    executeUnaryInteraction({
      context: createInteractionContext({ request: createRequest() }),
      mode: { id: "stream" },
      clientConfiguration: {},
      sdkResourceLimits: limits,
      adapter: unusedAdapter(),
      authorizationHandlers: [],
      payloadEncoder: { integrationComponents: [] },
      successPayloadDecoder: { integrationComponents: [] },
      errorPayloadDecoder: { integrationComponents: [] },
      transport: { interactionComponent: transport, integrationComponents: [] },
      interactionId: "interaction-validation",
    }),
  ).rejects.toMatchObject({ code: "unsupported_interaction_mode" });
  expect(sends).toBe(0);
});

it("fails resolution once and does not send", async () => {
  let sends = 0;
  const response: TransportResponse = {
    metadata: { outcome: "success", headers: [], extensions: {} },
    body: new Uint8Array(),
  };
  const transport = new MockTransport({
    descriptor: {
      name: "mock-transport",
      version: "1.0.0",
      capabilities: new Set(),
      source: "application",
    },
    response,
  });
  transport.send = () => {
    sends += 1;
    return Promise.resolve(response);
  };

  await expect(
    executeUnaryInteraction({
      context: createInteractionContext({ request: createRequest() }),
      mode: { id: "unary" },
      clientConfiguration: {},
      sdkResourceLimits: limits,
      authorizationHandlers: [],
      payloadEncoder: { integrationComponents: [] },
      successPayloadDecoder: { integrationComponents: [] },
      errorPayloadDecoder: { integrationComponents: [] },
      transport: { interactionComponent: transport, integrationComponents: [] },
      interactionId: "interaction-resolution",
    }),
  ).rejects.toMatchObject({ code: "missing_model_integration" });
  expect(sends).toBe(0);
});

it("does not read a credential when planning fails", async () => {
  let reads = 0;
  let sends = 0;
  const response: TransportResponse = {
    metadata: { outcome: "success", headers: [], extensions: {} },
    body: new Uint8Array(),
  };
  const transport = new MockTransport({
    descriptor: {
      name: "mock-transport",
      version: "1.0.0",
      capabilities: new Set(),
      source: "application",
    },
    response,
  });
  transport.send = () => {
    sends += 1;
    return Promise.resolve(response);
  };
  const request = createRequest();
  const serviceAccess = request.serviceAccess;
  if (serviceAccess === undefined) {
    throw new Error("The fixture request has no service access.");
  }

  await expect(
    executeUnaryInteraction({
      context: createInteractionContext({
        request: {
          ...request,
          serviceAccess: {
            ...serviceAccess,
            authorization: {
              kind: "authorization.bearer",
              credentialSource: {
                async getCredential() {
                  reads += 1;
                  throw new Error("credential");
                },
              },
            },
          },
        },
      }),
      mode: { id: "unary" },
      clientConfiguration: {},
      sdkResourceLimits: limits,
      adapter: {
        ...unusedAdapter(),
        supports: () => true,
        preparePlan: () => ({
          diagnostics: [
            {
              code: "planning_failed",
              severity: "error",
              phase: "planning",
              message: "The protocol plan could not be prepared.",
            },
          ],
        }),
      },
      authorizationHandlers: [],
      payloadEncoder: { integrationComponents: [] },
      successPayloadDecoder: { integrationComponents: [] },
      errorPayloadDecoder: { integrationComponents: [] },
      transport: { interactionComponent: transport, integrationComponents: [] },
      interactionId: "interaction-planning",
    }),
  ).rejects.toMatchObject({ code: "planning_failed" });
  expect(reads).toBe(0);
  expect(sends).toBe(0);
});

it("does not authorize when encoding fails", async () => {
  let authorizations = 0;
  const response: TransportResponse = {
    metadata: { outcome: "success", headers: [], extensions: {} },
    body: new Uint8Array(),
  };
  const transport = new MockTransport({
    descriptor: {
      name: "mock-transport",
      version: "1.0.0",
      capabilities: new Set(),
      source: "application",
      typeContract: {
        inputTypeId: bytesType,
        outputTypeId: bytesType,
        outputMediaTypes: [json],
      },
    },
    response,
  });
  const decoder: PayloadDecoder = {
    descriptor: {
      name: "decoder",
      version: "1.0.0",
      capabilities: new Set(),
      source: "builtin",
      typeContract: { inputTypeId: bytesType, outputTypeId: responseType, inputMediaTypes: [json] },
    },
    decode: async () => {
      throw new Error("decode");
    },
  };
  const errorDecoder: PayloadDecoder = {
    descriptor: {
      name: "error-decoder",
      version: "1.0.0",
      capabilities: new Set(),
      source: "builtin",
      typeContract: { inputTypeId: bytesType, outputTypeId: "protocol.error" },
    },
    decode: async () => {
      throw new Error("decode");
    },
  };

  await expect(
    executeUnaryInteraction({
      context: createInteractionContext({ request: createRequest() }),
      mode: { id: "unary" },
      clientConfiguration: {},
      sdkResourceLimits: limits,
      adapter: {
        ...unusedAdapter(),
        supports: () => true,
        preparePlan: () => ({ diagnostics: [], value: createPlan() }),
        buildRequest: () => ({
          diagnostics: [],
          value: {
            payload: { typeId: requestType, value: { text: "hello" } },
            executionPlan: createPlan(),
          },
        }),
      },
      authorizationHandlers: [
        {
          descriptor: {
            name: "handler",
            version: "1.0.0",
            capabilities: new Set(),
            source: "builtin",
          },
          supports: () => {
            authorizations += 1;
            return true;
          },
          apply: async () => {
            authorizations += 1;
            throw new Error("apply");
          },
        },
      ],
      payloadEncoder: {
        interactionComponent: {
          descriptor: {
            name: "encoder",
            version: "1.0.0",
            capabilities: new Set(),
            source: "builtin",
            typeContract: { inputTypeId: requestType, outputTypeId: bytesType },
          },
          encode: async () => {
            throw new Error("encode");
          },
        },
        integrationComponents: [],
      },
      successPayloadDecoder: { interactionComponent: decoder, integrationComponents: [] },
      errorPayloadDecoder: { interactionComponent: errorDecoder, integrationComponents: [] },
      transport: { interactionComponent: transport, integrationComponents: [] },
      interactionId: "interaction-encoding",
    }),
  ).rejects.toMatchObject({ code: "encoding_failed" });
  expect(authorizations).toBe(0);
});

function unusedAdapter(): TaskProtocolAdapter {
  const fail = (): never => {
    throw new Error("validation failure reached the adapter");
  };
  return {
    descriptor: {
      name: "unused-adapter",
      version: "1.0.0",
      capabilities: new Set(),
      source: "application",
    },
    supports: fail,
    preparePlan: fail,
    buildRequest: fail,
    parseResponse: fail,
    parseError: fail,
  };
}

function createRequest(): ModelRequest {
  return {
    target: {
      serviceId: "service.vendor",
      protocolId: "protocol.vendor",
      model: { name: "model-a", metadata: {}, extensions: {} },
      extensions: {},
    },
    task: {
      descriptor: { type: "conversation.generate", metadata: {}, extensions: {} },
      document: {
        version: "1.0",
        root: {
          id: "task-root",
          kind: "task.root",
          composition: "container",
          children: [
            {
              id: "conversation-input",
              kind: "task.input.conversation",
              composition: "leaf",
              messages: {
                version: "1.0",
                purpose: "input",
                root: {
                  id: "message-root",
                  kind: "message.root",
                  composition: "container",
                  children: [],
                  relations: [],
                  metadata: {},
                  extensions: {},
                },
                metadata: {},
                extensions: {},
              },
              relations: [],
              metadata: {},
              extensions: {},
            },
          ],
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
    serviceAccess: {
      endpoint: { kind: "absolute", value: "https://example.test/v1" },
      authorization: { kind: "authorization.none" },
      headers: [],
      query: [],
      extensions: {},
    },
    metadata: {},
    extensions: {},
  };
}

function createPlan(): ProtocolExecutionPlan {
  return {
    transportPlan: {
      endpoint: { kind: "absolute", value: "https://example.test/v1" },
      path: "/chat/completions",
      method: "POST",
      headers: [],
      query: [],
      authorization: { kind: "authorization.none" },
      transportExtensions: {},
    },
    payloadEncoder: { mediaType: json },
    successDecoder: { mediaType: json },
    errorDecoder: { mediaType: json },
    transport: { requiredCapabilities: new Set() },
    modeComponents: [],
    typeContract: { inputTypeId: requestType, outputTypeId: responseType },
    extensions: {},
  };
}

function createParsedResponse(): ParsedTaskResponse {
  return {
    result: {
      descriptor: { type: "conversation.generate", metadata: {}, extensions: {} },
      document: {
        version: "1.0",
        root: {
          id: "result-root",
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
}
