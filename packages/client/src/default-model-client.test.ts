// Copyright © 2026 Mcont.

import {
  ModelInteractionError,
  type ParsedTaskResponse,
  type ResolvedInteractionResourceLimits,
} from "@evolutos/mconet-core-domain";
import type {
  AuthorizationHandler,
  PayloadDecoder,
  PayloadEncoder,
  ProtocolExecutionPlan,
  TaskProtocolAdapter,
  TransportResponse,
} from "@evolutos/mconet-core-spi";
import { MockTransport } from "@evolutos/mconet-testing";
import { expect, it } from "vitest";

import { DefaultModelClient } from "./default-model-client.js";

const json = { type: "application", subtype: "json", parameters: {} } as const;
const requestType = "protocol.request";
const responseType = "protocol.response";
const bytesType = "codec.bytes";
const responseBytes = new Uint8Array([7]);
const limits: ResolvedInteractionResourceLimits = {
  maxResponseBodyBytes: 1024,
  maxStreamingErrorBodyBytes: 256,
  maxFrameBytes: 128,
};

it("delegates interact to the unary runtime", async () => {
  const request = createRequest();
  const response: TransportResponse = {
    metadata: { outcome: "success", headers: [], extensions: {}, mediaType: json },
    body: responseBytes,
  };
  let sends = 0;
  let decoded = new Uint8Array();
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
  const send = transport.send.bind(transport);
  transport.send = (transportRequest, context) => {
    sends += 1;
    return send(transportRequest, context);
  };
  const client = new DefaultModelClient({
    clientConfiguration: {},
    sdkResourceLimits: limits,
    adapter: createAdapter(createPlan()),
    authorizationHandlers: [passThroughHandler()],
    payloadEncoder: createEncoder(),
    successPayloadDecoder: createDecoder((bytes) => {
      decoded = bytes;
    }),
    errorPayloadDecoder: createErrorDecoder(),
    transport,
  });

  const output = await client.interact(request);
  const again = await client.interact(request);

  // Each open call enters the runtime once. The client does not store the first request.
  expect(sends).toBe(2);
  expect(decoded).toEqual(responseBytes);
  expect(output.status).toBe("completed");
  expect(again.status).toBe("completed");
  expect(output.target).toBe(request.target);
  expect(again.target).toBe(request.target);
});

it("resolves a second close without changing the closed client", async () => {
  const client = new DefaultModelClient({
    clientConfiguration: {},
    sdkResourceLimits: limits,
    authorizationHandlers: [],
  });

  await client.close();
  await expect(client.close()).resolves.toBeUndefined();
});

it("releases an SDK-created resource once", async () => {
  const calls: string[] = [];
  const sdkResource = {
    descriptor: {
      name: "sdk-transport",
      version: "1.0.0",
      capabilities: new Set<string>(),
      source: "builtin" as const,
    },
    close: () => {
      calls.push("sdk");
      return Promise.resolve();
    },
  };
  const client = new DefaultModelClient({
    clientConfiguration: {},
    sdkResourceLimits: limits,
    authorizationHandlers: [],
    sdkCreatedComponents: new Set([sdkResource]),
  });

  await client.close();
  await client.close();

  expect(calls).toEqual(["sdk"]);
});

it("does not release an injected resource", async () => {
  const calls: string[] = [];
  const sdkResource = closableResource("sdk", calls);
  const injected = closableResource("injected", calls);
  const client = new DefaultModelClient({
    clientConfiguration: {},
    sdkResourceLimits: limits,
    authorizationHandlers: [],
    transport: injected,
    sdkCreatedComponents: new Set([sdkResource]),
  });

  await client.close();

  expect(calls).toEqual(["sdk"]);
});

it("rejects a new request after close before transport", async () => {
  let sends = 0;
  const client = new DefaultModelClient({
    clientConfiguration: {},
    sdkResourceLimits: limits,
    authorizationHandlers: [],
    transport: {
      descriptor: {
        name: "transport",
        version: "1.0.0",
        capabilities: new Set(),
        source: "application",
      },
      send: () => {
        sends += 1;
        return Promise.reject(new Error("send"));
      },
    },
  });

  await client.close();

  await expect(client.interact(createRequest())).rejects.toBeInstanceOf(ModelInteractionError);
  await expect(client.interact(createRequest())).rejects.toMatchObject({
    code: "client_closed",
    category: "invalid_request",
    phase: "validation",
  });
  expect(sends).toBe(0);
});

function closableResource(name: string, calls: string[]) {
  return {
    descriptor: {
      name,
      version: "1.0.0",
      capabilities: new Set<string>(),
      source: "builtin" as const,
    },
    close: () => {
      calls.push(name);
      return Promise.resolve();
    },
    send: () => Promise.reject(new Error("unused")),
  };
}

function createEncoder(): PayloadEncoder {
  return {
    descriptor: {
      name: "encoder",
      version: "1.0.0",
      capabilities: new Set(),
      source: "builtin",
      typeContract: { inputTypeId: requestType, outputTypeId: bytesType },
    },
    encode: async () => ({ kind: "bytes", bytes: new Uint8Array([1]) }),
  };
}

function createDecoder(onBytes: (bytes: Uint8Array) => void): PayloadDecoder {
  return {
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
    decode: async (bytes) => {
      onBytes(bytes);
      return { typeId: responseType, value: { ok: true } };
    },
  };
}

function createErrorDecoder(): PayloadDecoder {
  return {
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
}

function passThroughHandler(): AuthorizationHandler {
  return {
    descriptor: {
      name: "handler",
      version: "1.0.0",
      capabilities: new Set(),
      source: "builtin",
    },
    supports: () => true,
    apply: async ({ request }) => request,
  };
}

function createAdapter(plan: ProtocolExecutionPlan): TaskProtocolAdapter {
  return {
    descriptor: {
      name: "adapter",
      version: "1.0.0",
      capabilities: new Set(),
      source: "application",
    },
    supports: () => true,
    preparePlan: () => ({ diagnostics: [], value: plan }),
    buildRequest: () => ({
      diagnostics: [],
      value: { payload: { typeId: requestType, value: { text: "hello" } }, executionPlan: plan },
    }),
    parseResponse: () => ({ diagnostics: [], value: createParsedResponse() }),
    parseError: () => {
      throw new Error("parseError");
    },
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

function createRequest() {
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
          composition: "container" as const,
          children: [
            {
              id: "conversation-input",
              kind: "task.input.conversation",
              composition: "leaf" as const,
              messages: {
                version: "1.0",
                purpose: "input" as const,
                root: {
                  id: "message-root",
                  kind: "message.root",
                  composition: "container" as const,
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
      endpoint: { kind: "absolute" as const, value: "https://example.test/v1" },
      authorization: { kind: "authorization.none" },
      headers: [],
      query: [],
      extensions: {},
    },
    metadata: {},
    extensions: {},
  };
}
