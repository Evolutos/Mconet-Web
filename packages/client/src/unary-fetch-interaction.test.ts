// Copyright © 2026 Mcont.

/**
 * Proves the unary runtime can finish one call on the Node Fetch transport.
 *
 * The local server is the service. Encoder bytes must arrive as the HTTP body,
 * and the HTTP response bytes must arrive at the success decoder. The transport
 * descriptor does not declare ports, so the test adds the bytes contract the
 * runtime connection check requires and still calls Fetch for the exchange.
 */

import { createServer, type AddressInfo } from "node:http";

import { createInteractionContext, executeUnaryInteraction } from "@evolutos/mconet-core-runtime";
import { NodeFetchTransport } from "@evolutos/mconet-transport-fetch-node";
import { expect, it } from "vitest";

const json = { type: "application", subtype: "json", parameters: {} } as const;
const requestType = "protocol.request";
const responseType = "protocol.response";
const bytesType = "codec.bytes";
const requestBytes = new Uint8Array([9, 8, 7]);
const responseBytes = new TextEncoder().encode('{"ok":true}');
const limits = {
  maxResponseBodyBytes: 1024,
  maxStreamingErrorBodyBytes: 256,
  maxFrameBytes: 128,
};

it("completes one unary interaction through the Node Fetch transport", async () => {
  let receivedMethod = "";
  let receivedUrl = "";
  let receivedBody = new Uint8Array();
  const server = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });
    request.on("end", () => {
      receivedMethod = request.method ?? "";
      receivedUrl = request.url ?? "";
      receivedBody = new Uint8Array(Buffer.concat(chunks));
      response.writeHead(200, { "content-type": "application/json" });
      response.end(responseBytes);
    });
  });
  const origin = await listen(server);

  try {
    let decoded = new Uint8Array();
    const plan = createPlan(origin);
    const fetchTransport = new NodeFetchTransport();
    const output = await executeUnaryInteraction({
      context: createInteractionContext({ request: createRequest(origin) }),
      mode: { id: "unary" },
      clientConfiguration: {},
      sdkResourceLimits: limits,
      adapter: createAdapter(plan),
      authorizationHandlers: [
        {
          descriptor: {
            name: "handler",
            version: "1.0.0",
            capabilities: new Set(),
            source: "builtin",
          },
          supports: () => true,
          apply: async ({ request }) => request,
        },
      ],
      payloadEncoder: { interactionComponent: createEncoder(), integrationComponents: [] },
      successPayloadDecoder: {
        interactionComponent: createDecoder((bytes) => {
          decoded = bytes;
        }),
        integrationComponents: [],
      },
      errorPayloadDecoder: {
        interactionComponent: createErrorDecoder(),
        integrationComponents: [],
      },
      transport: {
        // The production descriptor has no port contract. These ids are the
        // bytes connection the runtime already requires; send stays on Fetch.
        interactionComponent: {
          descriptor: {
            name: fetchTransport.descriptor.name,
            version: fetchTransport.descriptor.version,
            capabilities: fetchTransport.descriptor.capabilities,
            source: fetchTransport.descriptor.source,
            typeContract: {
              inputTypeId: bytesType,
              outputTypeId: bytesType,
              outputMediaTypes: [json],
            },
          },
          send: (request, context) => fetchTransport.send(request, context),
        },
        integrationComponents: [],
      },
      interactionId: "fetch-unary",
    });

    expect(receivedMethod).toBe("POST");
    expect(receivedUrl).toBe("/chat/completions");
    expect(receivedBody).toEqual(requestBytes);
    expect(decoded).toEqual(responseBytes);
    expect(output.status).toBe("completed");
    expect(output.target.model.name).toBe("model-a");
  } finally {
    await closeServer(server);
  }
});

function listen(server: ReturnType<typeof createServer>): Promise<string> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.removeListener("error", reject);
      const address = server.address();
      if (address === null || typeof address === "string") {
        reject(new Error("The Fetch test server did not bind a TCP port."));
        return;
      }
      resolve(originFor(address));
    });
  });
}

function closeServer(server: ReturnType<typeof createServer>): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

function originFor(address: AddressInfo): string {
  return `http://127.0.0.1:${address.port}`;
}

function createEncoder() {
  return {
    descriptor: {
      name: "encoder",
      version: "1.0.0",
      capabilities: new Set(),
      source: "builtin",
      typeContract: { inputTypeId: requestType, outputTypeId: bytesType },
    },
    encode: async () => ({ kind: "bytes", bytes: requestBytes }),
  };
}

function createDecoder(onBytes: (bytes: Uint8Array) => void) {
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

function createErrorDecoder() {
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

function createAdapter(plan: ReturnType<typeof createPlan>) {
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

function createPlan(origin: string) {
  return {
    transportPlan: {
      endpoint: { kind: "absolute" as const, value: origin },
      path: "/chat/completions",
      method: "POST" as const,
      headers: [],
      query: [],
      authorization: { kind: "authorization.none" },
      transportExtensions: {},
    },
    payloadEncoder: { mediaType: json },
    successDecoder: { mediaType: json },
    errorDecoder: { mediaType: json },
    transport: { requiredCapabilities: new Set<string>() },
    modeComponents: [],
    typeContract: { inputTypeId: requestType, outputTypeId: responseType },
    extensions: {},
  };
}

function createParsedResponse() {
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

function createRequest(origin: string) {
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
