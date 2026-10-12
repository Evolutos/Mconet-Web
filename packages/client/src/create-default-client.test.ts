// Copyright © 2026 Mcont.

import { createServer } from "node:http";

import { ModelInteractionError, type ParsedTaskResponse } from "@evolutos/mconet-core-domain";
import type {
  ProtocolExecutionPlan,
  TaskProtocolAdapter,
  Transport,
} from "@evolutos/mconet-core-spi";
import { expect, it } from "vitest";

import { createDefaultClient } from "./browser-client.js";

const json = { type: "application", subtype: "json", parameters: {} } as const;
const jsonValue = "json.value";

it("completes one JSON exchange through Fetch", async () => {
  let receivedBody = "";
  const server = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });
    request.on("end", () => {
      receivedBody = Buffer.concat(chunks).toString("utf8");
      response.writeHead(200, { "content-type": "application/json" });
      response.end('{"ok":true}');
    });
  });
  const origin = await listen(server);

  try {
    const client = createDefaultClient({ adapter: createAdapter(origin) });
    const output = await client.interact(createRequest(origin));

    expect(receivedBody).toBe('{"hello":"world"}');
    expect(output.status).toBe("completed");
    expect(output.target.model.name).toBe("vendor-model");
  } finally {
    await closeServer(server);
  }
});

it("rejects a transport that has no send method", () => {
  const transport = {
    descriptor: {
      name: "transport",
      version: "1.0.0",
      capabilities: new Set(),
      source: "application",
    },
  } as unknown as Transport;

  expect(() =>
    createDefaultClient({
      adapter: createAdapter("https://example.test"),
      components: { transport },
    }),
  ).toThrow(TypeError);
});

it("rejects a transport whose byte port does not match the JSON encoder", () => {
  const transport = {
    descriptor: {
      name: "transport",
      version: "1.0.0",
      capabilities: new Set(),
      source: "application" as const,
      typeContract: { inputTypeId: "codec.other", outputTypeId: "codec.other" },
    },
    send: () => Promise.reject(new Error("unused")),
  } as unknown as Transport;

  expect(() =>
    createDefaultClient({
      adapter: createAdapter("https://example.test"),
      components: { transport },
    }),
  ).toThrow(ModelInteractionError);
});

function listen(server: ReturnType<typeof createServer>): Promise<string> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.removeListener("error", reject);
      const address = server.address();
      if (address === null || typeof address === "string") {
        reject(new Error("The default client server did not bind a TCP port."));
        return;
      }
      resolve(`http://127.0.0.1:${address.port}`);
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

function createAdapter(origin: string): TaskProtocolAdapter {
  const plan = createPlan(origin);
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

function isOk(value: unknown): boolean {
  return typeof value === "object" && value !== null && "ok" in value && value.ok === true;
}

function createPlan(origin: string): ProtocolExecutionPlan {
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

function createRequest(origin: string) {
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
