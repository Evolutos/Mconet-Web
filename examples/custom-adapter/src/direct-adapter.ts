// Copyright © 2026 Mcont.

import { createDefaultClient } from "@evolutos/mconet-client";
import type { ParsedTaskResponse } from "@evolutos/mconet-core-domain";
import type {
  ProtocolExecutionPlan,
  TaskProtocolAdapter,
  Transport,
} from "@evolutos/mconet-core-spi";

/** JSON media type shared by the plan ports and the memory transport. */
const json = { type: "application", subtype: "json", parameters: {} } as const;

/** Semantic type used by the JSON codecs. */
const jsonValue = "json.value";

/** Endpoint named by the plan. The memory transport does not dial it. */
const origin = "https://provider.example.test";

/**
 * Direct adapter example.
 *
 * The adapter is passed to the client as its adapter. No integration resolver
 * is installed, and this file does not modify Core.
 *
 * @returns A client whose adapter is the example adapter.
 */
export function createDirectAdapterClient() {
  return createDefaultClient({
    adapter: createDirectAdapter(),
    components: { transport: createMemoryTransport() },
  });
}

/**
 * Request the direct adapter supports.
 *
 * @returns One conversation request for the example provider.
 */
export function createDirectAdapterRequest() {
  return {
    target: {
      serviceId: "service.vendor",
      protocolId: "protocol.vendor",
      model: { name: "vendor-model", metadata: {}, extensions: {} },
      extensions: {},
    },
    task: {
      descriptor: { type: "conversation.generate", metadata: {}, extensions: {} },
      document: {
        version: "1.0",
        root: {
          id: "task-root",
          kind: "task.root" as const,
          composition: "container" as const,
          children: [
            {
              id: "conversation-input",
              kind: "task.input.conversation" as const,
              composition: "leaf" as const,
              messages: {
                version: "1.0",
                purpose: "input" as const,
                root: {
                  id: "message-root",
                  kind: "message.root" as const,
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
      endpoint: { kind: "absolute" as const, value: origin },
      authorization: { kind: "authorization.none" },
      headers: [],
      query: [],
      extensions: {},
    },
    metadata: {},
    extensions: {},
  };
}

function createDirectAdapter(): TaskProtocolAdapter {
  const plan = createPlan();
  return {
    descriptor: {
      name: "direct-adapter",
      version: "1.0.0",
      capabilities: new Set(),
      source: "application",
    },
    supports: () => true,
    preparePlan: () => ({ diagnostics: [], value: plan }),
    buildRequest: () => ({
      diagnostics: [],
      value: {
        payload: { typeId: jsonValue, value: { hello: "world" } },
        executionPlan: plan,
      },
    }),
    parseResponse: ({ payload }) => {
      if (payload.typeId !== jsonValue || !isOk(payload.value)) {
        throw new Error("unexpected payload");
      }
      return { diagnostics: [], value: createParsedResponse() };
    },
    parseError: () => {
      throw new Error("parseError");
    },
  };
}

function createMemoryTransport(): Transport {
  return {
    descriptor: {
      name: "memory-transport",
      version: "1.0.0",
      capabilities: new Set(),
      source: "application",
      typeContract: {
        inputTypeId: "codec.bytes",
        outputTypeId: "codec.bytes",
        outputMediaTypes: [json],
      },
    },
    send: () =>
      Promise.resolve({
        metadata: {
          outcome: "success",
          statusCode: 200,
          headers: [],
          mediaType: json,
          extensions: {},
        },
        body: new TextEncoder().encode('{"ok":true}'),
      }),
  };
}

function isOk(value: unknown): boolean {
  return typeof value === "object" && value !== null && "ok" in value && value.ok === true;
}

function createPlan(): ProtocolExecutionPlan {
  return {
    transportPlan: {
      endpoint: { kind: "absolute", value: origin },
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
    typeContract: {
      inputTypeId: jsonValue,
      outputTypeId: jsonValue,
      inputMediaTypes: [json],
      outputMediaTypes: [json],
    },
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
