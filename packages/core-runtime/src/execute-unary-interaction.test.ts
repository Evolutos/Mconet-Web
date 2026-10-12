// Copyright © 2026 Mcont.

import {
  SecretValue,
  type Authorization,
  type ModelRequest,
  type ParsedTaskResponse,
  type ResolvedInteractionResourceLimits,
} from "@evolutos/mconet-core-domain";
import type {
  AuthorizationHandler,
  CredentialSource,
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

it("does not send when authorization has no handler", async () => {
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
      typeContract: {
        inputTypeId: bytesType,
        outputTypeId: bytesType,
        outputMediaTypes: [json],
      },
    },
    response,
  });
  transport.send = () => {
    sends += 1;
    return Promise.resolve(response);
  };
  const decoder = idleDecoder("decoder", responseType, [json]);
  const errorDecoder = idleDecoder("error-decoder", "protocol.error");

  await expect(
    executeUnaryInteraction({
      context: createInteractionContext({ request: createRequest() }),
      mode: { id: "unary" },
      clientConfiguration: {},
      sdkResourceLimits: limits,
      adapter: planningAdapter(),
      authorizationHandlers: [
        {
          descriptor: {
            name: "handler",
            version: "1.0.0",
            capabilities: new Set(),
            source: "builtin",
          },
          supports: () => false,
          apply: async () => {
            throw new Error("apply");
          },
        },
      ],
      payloadEncoder: { interactionComponent: encodingEncoder(), integrationComponents: [] },
      successPayloadDecoder: { interactionComponent: decoder, integrationComponents: [] },
      errorPayloadDecoder: { interactionComponent: errorDecoder, integrationComponents: [] },
      transport: { interactionComponent: transport, integrationComponents: [] },
      interactionId: "interaction-authentication",
    }),
  ).rejects.toMatchObject({ code: "authorization_handler_not_found" });
  expect(sends).toBe(0);
});

it("reports a network error when the transport fails", async () => {
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
  transport.send = () => {
    throw new Error("network-secret");
  };
  const decoder = idleDecoder("decoder", responseType, [json]);
  const errorDecoder = idleDecoder("error-decoder", "protocol.error");

  await expect(
    executeUnaryInteraction({
      context: createInteractionContext({ request: createRequest() }),
      mode: { id: "unary" },
      clientConfiguration: {},
      sdkResourceLimits: limits,
      adapter: planningAdapter(),
      authorizationHandlers: [
        {
          descriptor: {
            name: "handler",
            version: "1.0.0",
            capabilities: new Set(),
            source: "builtin",
          },
          supports: () => true,
          apply: async ({ request: authorizedRequest }) => authorizedRequest,
        },
      ],
      payloadEncoder: { interactionComponent: encodingEncoder(), integrationComponents: [] },
      successPayloadDecoder: { interactionComponent: decoder, integrationComponents: [] },
      errorPayloadDecoder: { interactionComponent: errorDecoder, integrationComponents: [] },
      transport: { interactionComponent: transport, integrationComponents: [] },
      interactionId: "interaction-transport",
    }),
  ).rejects.toMatchObject({
    code: "transport_failed",
    category: "network",
    phase: "transport",
  });
});

it("releases the response and context when decoding fails", async () => {
  const released: string[] = [];
  const response: TransportResponse = {
    metadata: { outcome: "success", headers: [], extensions: {}, mediaType: json },
    body: new Uint8Array([9]),
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
  const decoder = idleDecoder("decoder", responseType, [json]);
  decoder.decode = async () => {
    throw new Error("decoder-secret");
  };

  await expect(
    executeUnaryInteraction({
      context: createInteractionContext({ request: createRequest() }),
      mode: { id: "unary" },
      clientConfiguration: {},
      sdkResourceLimits: limits,
      adapter: planningAdapter(),
      authorizationHandlers: [passThroughHandler()],
      payloadEncoder: { interactionComponent: encodingEncoder(), integrationComponents: [] },
      successPayloadDecoder: { interactionComponent: decoder, integrationComponents: [] },
      errorPayloadDecoder: {
        interactionComponent: idleDecoder("error-decoder", "protocol.error"),
        integrationComponents: [],
      },
      transport: { interactionComponent: transport, integrationComponents: [] },
      interactionId: "interaction-decoding",
      releaseResponse: () => {
        released.push("response");
      },
      releaseContext: () => {
        released.push("context");
      },
    }),
  ).rejects.toMatchObject({
    code: "decoding_failed",
    category: "deserialization",
    message: expect.not.stringMatching(/decoder-secret/u),
  });
  expect(released).toEqual(["response", "context"]);
});

it("releases the response and context when response parsing fails", async () => {
  const released: string[] = [];
  const response: TransportResponse = {
    metadata: { outcome: "success", headers: [], extensions: {}, mediaType: json },
    body: new Uint8Array([9]),
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
  const decoder = idleDecoder("decoder", responseType, [json]);
  decoder.decode = async () => ({ typeId: responseType, value: { ok: true } });

  await expect(
    executeUnaryInteraction({
      context: createInteractionContext({ request: createRequest() }),
      mode: { id: "unary" },
      clientConfiguration: {},
      sdkResourceLimits: limits,
      adapter: {
        ...planningAdapter(),
        parseResponse: () => {
          throw new Error("parser-secret");
        },
      },
      authorizationHandlers: [passThroughHandler()],
      payloadEncoder: { interactionComponent: encodingEncoder(), integrationComponents: [] },
      successPayloadDecoder: { interactionComponent: decoder, integrationComponents: [] },
      errorPayloadDecoder: {
        interactionComponent: idleDecoder("error-decoder", "protocol.error"),
        integrationComponents: [],
      },
      transport: { interactionComponent: transport, integrationComponents: [] },
      interactionId: "interaction-parsing",
      releaseResponse: () => {
        released.push("response");
      },
      releaseContext: () => {
        released.push("context");
      },
    }),
  ).rejects.toMatchObject({
    code: "response_parsing_failed",
    message: expect.not.stringMatching(/parser-secret/u),
  });
  expect(released).toEqual(["response", "context"]);
});

it("uses the interaction encoder instead of a client encoder", async () => {
  const marker = encodingEncoder();
  const names = await encodeWith({
    interactionComponent: marker,
    clientComponent: marker,
    integrationComponents: [marker],
    sdkDefaultComponent: marker,
  });

  expect(names).toEqual(["interaction"]);
});

it("uses the client encoder instead of a plugin encoder", async () => {
  const marker = encodingEncoder();
  const names = await encodeWith({
    clientComponent: marker,
    integrationComponents: [marker],
    sdkDefaultComponent: marker,
  });

  expect(names).toEqual(["client"]);
});

it("uses a plugin encoder instead of the SDK default encoder", async () => {
  const marker = encodingEncoder();
  const names = await encodeWith({
    integrationComponents: [marker],
    sdkDefaultComponent: marker,
  });

  expect(names).toEqual(["plugin"]);
});

it("keeps concurrent requests on their own targets", async () => {
  let entered = 0;
  let releaseBoth: () => void = () => undefined;
  const bothEntered = new Promise<void>((resolve) => {
    releaseBoth = resolve;
  });
  const onEncode = async (): Promise<void> => {
    entered += 1;
    if (entered === 2) {
      releaseBoth();
      return;
    }
    await bothEntered;
  };
  const requestA = requestNamed("model-a");
  const requestB = requestNamed("model-b");

  const [outputA, outputB] = await Promise.all([
    completeInteraction({ request: requestA, interactionId: "interaction-a", onEncode }),
    completeInteraction({ request: requestB, interactionId: "interaction-b", onEncode }),
  ]);

  expect(outputA.target).toBe(requestA.target);
  expect(outputB.target).toBe(requestB.target);
  expect(outputA.target.model.name).toBe("model-a");
  expect(outputB.target.model.name).toBe("model-b");
});

it("does not share credentials across concurrent interactions", async () => {
  let entered = 0;
  let releaseBoth: () => void = () => undefined;
  const bothEntered = new Promise<void>((resolve) => {
    releaseBoth = resolve;
  });
  const appliedSources: Array<CredentialSource | undefined> = [];
  const calls = { a: 0, b: 0 };
  const sourceFor = (label: "a" | "b", secret: string): CredentialSource => ({
    async getCredential() {
      calls[label] += 1;
      entered += 1;
      if (entered === 2) {
        releaseBoth();
      } else {
        await bothEntered;
      }
      return new SecretValue(secret);
    },
  });
  // Resolution copies authorization, so isolation is the credential-source
  // reference that the copy retains, not the original object identity.
  const sourceA = sourceFor("a", "credential-a");
  const sourceB = sourceFor("b", "credential-b");
  const authorizationA = {
    kind: "authorization.bearer",
    credentialSource: sourceA,
  };
  const authorizationB = {
    kind: "authorization.bearer",
    credentialSource: sourceB,
  };
  const handlerFor = (expected: CredentialSource): AuthorizationHandler => ({
    descriptor: {
      name: "handler",
      version: "1.0.0",
      capabilities: new Set(),
      source: "builtin",
    },
    supports: () => true,
    apply: async ({ request, authorization }) => {
      const source =
        "credentialSource" in authorization &&
        typeof authorization.credentialSource === "object" &&
        authorization.credentialSource !== null &&
        "getCredential" in authorization.credentialSource
          ? authorization.credentialSource
          : undefined;
      appliedSources.push(source === expected ? expected : undefined);
      return request;
    },
  });

  await Promise.all([
    completeInteraction({
      request: requestNamed("model-a"),
      interactionId: "credential-a",
      authorization: authorizationA,
      handler: handlerFor(sourceA),
    }),
    completeInteraction({
      request: requestNamed("model-b"),
      interactionId: "credential-b",
      authorization: authorizationB,
      handler: handlerFor(sourceB),
    }),
  ]);

  expect(calls).toEqual({ a: 1, b: 1 });
  expect(appliedSources).toHaveLength(2);
  expect(appliedSources).toContain(sourceA);
  expect(appliedSources).toContain(sourceB);
  expect(JSON.stringify(appliedSources)).not.toContain("credential-a");
  expect(JSON.stringify(appliedSources)).not.toContain("credential-b");
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

function planningAdapter(): TaskProtocolAdapter {
  return {
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
    apply: async ({ request: authorizedRequest }) => authorizedRequest,
  };
}

function namedEncoder(name: string, names: string[]): PayloadEncoder {
  return {
    descriptor: {
      name,
      version: "1.0.0",
      capabilities: new Set(),
      source: "application",
      typeContract: { inputTypeId: requestType, outputTypeId: bytesType },
    },
    encode: async () => {
      names.push(name);
      return { kind: "bytes", bytes: new Uint8Array([1]) };
    },
  };
}

/**
 * Runs the pipeline until decoding fails and records which encoder tier ran.
 *
 * The supplied encoders are presence markers. Each present tier is replaced
 * with an encoder that records that tier name, so the result shows priority
 * rather than which marker instance was retained.
 *
 * @param payloadEncoder Tier markers. An omitted tier is absent from selection.
 * @returns The tier names whose encode method ran, in call order.
 */
async function encodeWith(
  payloadEncoder: Parameters<typeof executeUnaryInteraction>[0]["payloadEncoder"],
): Promise<readonly string[]> {
  const names: string[] = [];
  const tiers = {
    interactionComponent:
      payloadEncoder.interactionComponent === undefined
        ? undefined
        : namedEncoder("interaction", names),
    clientComponent:
      payloadEncoder.clientComponent === undefined ? undefined : namedEncoder("client", names),
    integrationComponents: payloadEncoder.integrationComponents.map(() =>
      namedEncoder("plugin", names),
    ),
    sdkDefaultComponent:
      payloadEncoder.sdkDefaultComponent === undefined ? undefined : namedEncoder("sdk", names),
  };
  const response: TransportResponse = {
    metadata: { outcome: "success", headers: [], extensions: {}, mediaType: json },
    body: new Uint8Array([3]),
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
  await expect(
    executeUnaryInteraction({
      context: createInteractionContext({ request: createRequest() }),
      mode: { id: "unary" },
      clientConfiguration: {},
      sdkResourceLimits: limits,
      adapter: planningAdapter(),
      authorizationHandlers: [passThroughHandler()],
      payloadEncoder: {
        integrationComponents: tiers.integrationComponents,
        ...(tiers.interactionComponent === undefined
          ? {}
          : { interactionComponent: tiers.interactionComponent }),
        ...(tiers.clientComponent === undefined ? {} : { clientComponent: tiers.clientComponent }),
        ...(tiers.sdkDefaultComponent === undefined
          ? {}
          : { sdkDefaultComponent: tiers.sdkDefaultComponent }),
      },
      successPayloadDecoder: {
        interactionComponent: idleDecoder("decoder", responseType, [json]),
        integrationComponents: [],
      },
      errorPayloadDecoder: {
        interactionComponent: idleDecoder("error-decoder", "protocol.error"),
        integrationComponents: [],
      },
      transport: { interactionComponent: transport, integrationComponents: [] },
      interactionId: "interaction-priority",
    }),
  ).rejects.toMatchObject({ code: "decoding_failed" });
  return names;
}

function encodingEncoder(): PayloadEncoder {
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

function idleDecoder(
  name: string,
  outputTypeId: string,
  inputMediaTypes?: readonly (typeof json)[],
): PayloadDecoder {
  return {
    descriptor: {
      name,
      version: "1.0.0",
      capabilities: new Set(),
      source: "builtin",
      typeContract: {
        inputTypeId: bytesType,
        outputTypeId,
        ...(inputMediaTypes === undefined ? {} : { inputMediaTypes }),
      },
    },
    decode: async () => {
      throw new Error("decode");
    },
  };
}

/**
 * Completes one interaction so concurrent calls can overlap inside encode.
 *
 * @param input Request identity and an optional encode pause.
 * @returns The assembled output for that request only.
 */
async function completeInteraction(input: {
  readonly request: ModelRequest;
  readonly interactionId: string;
  readonly onEncode?: () => Promise<void>;
  readonly authorization?: Authorization;
  readonly handler?: AuthorizationHandler;
}): Promise<Awaited<ReturnType<typeof executeUnaryInteraction>>> {
  const response: TransportResponse = {
    metadata: { outcome: "success", headers: [], extensions: {}, mediaType: json },
    body: new Uint8Array([4]),
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
  const encoder = encodingEncoder();
  if (input.onEncode !== undefined) {
    const pause = input.onEncode;
    const encode = encoder.encode.bind(encoder);
    encoder.encode = async (value, context) => {
      await pause();
      return encode(value, context);
    };
  }
  const decoder = idleDecoder("decoder", responseType, [json]);
  decoder.decode = async () => ({ typeId: responseType, value: { ok: true } });
  const request =
    input.authorization === undefined || input.request.serviceAccess === undefined
      ? input.request
      : {
          ...input.request,
          serviceAccess: {
            ...input.request.serviceAccess,
            authorization: input.authorization,
          },
        };
  return executeUnaryInteraction({
    context: createInteractionContext({ request }),
    mode: { id: "unary" },
    clientConfiguration: {},
    sdkResourceLimits: limits,
    adapter: {
      ...planningAdapter(),
      parseResponse: () => ({ diagnostics: [], value: createParsedResponse() }),
    },
    authorizationHandlers: [input.handler ?? passThroughHandler()],
    payloadEncoder: { interactionComponent: encoder, integrationComponents: [] },
    successPayloadDecoder: { interactionComponent: decoder, integrationComponents: [] },
    errorPayloadDecoder: {
      interactionComponent: idleDecoder("error-decoder", "protocol.error"),
      integrationComponents: [],
    },
    transport: { interactionComponent: transport, integrationComponents: [] },
    interactionId: input.interactionId,
  });
}

function requestNamed(name: string): ModelRequest {
  const request = createRequest();
  return {
    ...request,
    target: {
      ...request.target,
      model: { name, metadata: {}, extensions: {} },
    },
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
