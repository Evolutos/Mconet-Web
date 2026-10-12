// Copyright © 2026 Mcont.

import type { PayloadEncoder, Transport } from "@evolutos/mconet-core-spi";
import { MockTransport } from "@evolutos/mconet-testing";
import { expect, it } from "vitest";

import { createDefaultClient } from "./create-default-client.js";
import { mapClientComponents } from "./map-client-components.js";

const json = { type: "application", subtype: "json", parameters: {} } as const;

it("copies client components by identity and omits the rest", () => {
  const transport = fakeTransport();
  const encoder = fakeEncoder();
  const mapped = mapClientComponents({ transport, payloadEncoder: encoder });

  expect(mapped.transport).toBe(transport);
  expect(mapped.payloadEncoder).toBe(encoder);
  expect(mapped.adapter).toBeUndefined();
  expect(mapped.successPayloadDecoder).toBeUndefined();
});

it("uses an injected client transport instead of Fetch", async () => {
  let fetches = 0;
  const original = globalThis.fetch;
  globalThis.fetch = () => {
    fetches += 1;
    return Promise.reject(new Error("fetch"));
  };
  const response = {
    metadata: { outcome: "success" as const, headers: [], extensions: {}, mediaType: json },
    body: new TextEncoder().encode('{"ok":true}'),
  };
  const transport = new MockTransport({
    descriptor: {
      name: "mock-transport",
      version: "1.0.0",
      capabilities: new Set(),
      source: "application",
      typeContract: {
        inputTypeId: "codec.bytes",
        outputTypeId: "codec.bytes",
        outputMediaTypes: [json],
      },
    },
    response,
  });
  let sends = 0;
  const send = transport.send.bind(transport);
  transport.send = (request, context) => {
    sends += 1;
    return send(request, context);
  };
  const client = createDefaultClient({
    adapter: {
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
          payload: { typeId: "json.value", value: { hello: "world" } },
          executionPlan: plan,
        },
      }),
      parseResponse: ({ payload }) => {
        if (!isOk(payload.value)) {
          throw new Error("payload");
        }
        return { diagnostics: [], value: parsed };
      },
      parseError: () => {
        throw new Error("parseError");
      },
    },
    components: { transport },
  });

  try {
    const output = await client.interact(request);
    expect(sends).toBe(1);
    expect(fetches).toBe(0);
    expect(output.status).toBe("completed");
  } finally {
    globalThis.fetch = original;
  }
});

const plan = {
  transportPlan: {
    endpoint: { kind: "absolute" as const, value: "https://example.test/v1" },
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
  typeContract: {
    inputTypeId: "json.value",
    outputTypeId: "json.value",
    inputMediaTypes: [json],
    outputMediaTypes: [json],
  },
  extensions: {},
};

const request = {
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
    endpoint: { kind: "absolute" as const, value: "https://example.test/v1" },
    authorization: { kind: "authorization.none" },
    headers: [],
    query: [],
    extensions: {},
  },
  metadata: {},
  extensions: {},
};

const parsed = {
  result: {
    descriptor: { type: "conversation.generate", metadata: {}, extensions: {} },
    document: {
      version: "1.0",
      root: {
        id: "result-root",
        kind: "task.root" as const,
        composition: "container" as const,
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
  status: "completed" as const,
  protocolState: [],
  extensions: {},
};

function isOk(value: unknown): boolean {
  return typeof value === "object" && value !== null && "ok" in value && value.ok === true;
}

function fakeTransport(): Transport {
  return {
    descriptor: {
      name: "transport",
      version: "1.0.0",
      capabilities: new Set(),
      source: "application",
    },
    send: () => Promise.reject(new Error("unused")),
  };
}

function fakeEncoder(): PayloadEncoder {
  return {
    descriptor: {
      name: "encoder",
      version: "1.0.0",
      capabilities: new Set(),
      source: "application",
    },
    encode: () => Promise.reject(new Error("unused")),
  };
}
