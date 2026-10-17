// Copyright © 2026 Mcont.

import {
  apiKeyHeaderAuthorizationKind,
  bearerAuthorizationKind,
  FixedCredentialSource,
  type ApiKeyHeaderAuthorization,
  type BearerAuthorization,
} from "@evolutos/mconet-auth-basic";
import {
  ModelInteractionError,
  projectConversationText,
  SecretValue,
  type ConversationTaskResult,
  type ServiceAccess,
} from "@evolutos/mconet-core-domain";
import { expect, it } from "vitest";

import { conversationRequest } from "./conversation-request.js";
import type { TextStreamInteraction } from "./text-stream-interaction.js";
import { createOpenAICompatibleClient as createBrowserClient } from "./create-openai-compatible-client.js";
import { createOpenAICompatibleClient as createNodeClient } from "./node-client.js";
import { streamText } from "./stream-text.js";

const target = {
  serviceId: "service.vendor",
  protocolId: "openai.chat.completions",
  model: { name: "vendor-model", metadata: {}, extensions: {} },
  extensions: {},
};
const serviceAccess = {
  endpoint: { kind: "absolute" as const, value: "https://example.test/v1" },
  authorization: { kind: "authorization.none" },
  headers: [],
  query: [],
  extensions: {},
};
const successBody = {
  id: "resp-1",
  model: "vendor-model",
  choices: [
    {
      index: 0,
      message: { role: "assistant", content: "hello" },
      finish_reason: "stop",
    },
  ],
  usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 },
};
const serviceBodyText = "service-body-text";

/** Credential text used only to prove a header was applied. */
const fixtureCredential = "fixture-credential";

/** Lowercase API-key field selected by the API-key authorization description. */
const apiKeyHeaderName = "x-api-key";

const bearerAuthorization: BearerAuthorization = {
  kind: bearerAuthorizationKind,
  credentialSource: new FixedCredentialSource(new SecretValue(fixtureCredential)),
};
const apiKeyAuthorization: ApiKeyHeaderAuthorization = {
  kind: apiKeyHeaderAuthorizationKind,
  headerName: apiKeyHeaderName,
  credentialSource: new FixedCredentialSource(new SecretValue(fixtureCredential)),
};
const bearerAccess: ServiceAccess = {
  endpoint: { kind: "absolute", value: "https://example.test/v1" },
  authorization: bearerAuthorization,
  headers: [],
  query: [],
  extensions: {},
};
const apiKeyAccess: ServiceAccess = {
  endpoint: { kind: "absolute", value: "https://example.test/v1" },
  authorization: apiKeyAuthorization,
  headers: [],
  query: [],
  extensions: {},
};

type OpenAIClientFactory = typeof createBrowserClient;

it("completes one chat exchange through the browser client", async () => {
  const output = await exchange(createBrowserClient, 200, successBody);
  expect(output.requestText).toContain("Hello");
  expect(headerValue(output.headers, "authorization")).toBeUndefined();
  expect(projectConversationText(output.result)).toBe("hello");
  expect(output.stopReason).toBe("stop");
  expect(output.usage).toEqual({
    inputTokens: 1,
    outputTokens: 2,
    totalTokens: 3,
    extensions: {},
  });
});

it("completes one chat exchange through the Node client", async () => {
  const output = await exchange(createNodeClient, 200, successBody);
  expect(JSON.parse(output.requestText)).toMatchObject({ stream: false });
  expect(projectConversationText(output.result)).toBe("hello");
  expect(output.usage).toMatchObject({ inputTokens: 1, outputTokens: 2, totalTokens: 3 });
});

it.each([
  ["browser", createBrowserClient],
  ["node", createNodeClient],
] as const)(
  "streams chat text through the %s client and sends stream true",
  async (_name, createClient) => {
    const streamed = await streamExchange(createClient, (client) =>
      client.stream(
        conversationRequest({
          target,
          messages: [{ role: "user", text: "Hello" }],
          serviceAccess,
        }),
      ),
    );
    expect(streamed.wire.stream).toBe(true);
    expect(streamed.fragments).toEqual(["你", "好"]);
    expect(projectConversationText(streamed.result)).toBe("你好");
    expect(streamed.stopReason).toBe("stop");
  },
);

it("streams chat text through streamText on both platform clients", async () => {
  for (const createClient of [createBrowserClient, createNodeClient]) {
    const streamed = await streamExchange(createClient, (client) =>
      streamText(client, {
        target,
        messages: [{ role: "user", text: "Hello" }],
        serviceAccess,
      }),
    );
    expect(streamed.wire.stream).toBe(true);
    expect(streamed.fragments).toEqual(["你", "好"]);
    expect(projectConversationText(streamed.result)).toBe("你好");
  }
});

it("completes a Bearer chat exchange on both platform clients", async () => {
  for (const createClient of [createBrowserClient, createNodeClient]) {
    const output = await exchange(createClient, 200, successBody, bearerAccess);
    expect(output.requestText).toContain("Hello");
    expect(headerValue(output.headers, "authorization")).toBe(`Bearer ${fixtureCredential}`);
    expect(projectConversationText(output.result)).toBe("hello");
    expect(output.stopReason).toBe("stop");
  }
});

it("completes an API-key chat exchange on both platform clients", async () => {
  for (const createClient of [createBrowserClient, createNodeClient]) {
    const output = await exchange(createClient, 200, successBody, apiKeyAccess);
    expect(output.requestText).toContain("Hello");
    expect(headerValue(output.headers, apiKeyHeaderName)).toBe(fixtureCredential);
    expect(headerValue(output.headers, "authorization")).toBeUndefined();
    expect(projectConversationText(output.result)).toBe("hello");
  }
});

it("rejects a target whose protocol is not chat completions before sending", async () => {
  let fetchCalled = false;
  const original = globalThis.fetch;
  globalThis.fetch = (() => {
    fetchCalled = true;
    return Promise.reject(new Error("The unmatched protocol must not send."));
  }) as typeof fetch;
  const otherTarget = { ...target, protocolId: "other.protocol" };
  try {
    const client = createBrowserClient({ target: otherTarget, serviceAccess });
    await expect(
      client.interact(
        conversationRequest({
          target: otherTarget,
          messages: [{ role: "user", text: "Hello" }],
          serviceAccess,
        }),
      ),
    ).rejects.toMatchObject({
      category: "unsupported_feature",
      code: "unsupported_integration",
    });
    expect(fetchCalled).toBe(false);
  } finally {
    globalThis.fetch = original;
  }
});

it("maps an HTTP 401 from the chat service to authentication", async () => {
  const failure = await rejectedExchange(createBrowserClient, 401, {
    error: { message: serviceBodyText, type: "invalid_request_error", code: "invalid_api_key" },
  });
  expect(failure).toBeInstanceOf(ModelInteractionError);
  expect(failure.category).toBe("authentication");
  expect(failure.message).not.toContain(serviceBodyText);
});

/**
 * Runs one chat interaction against a Fetch double.
 *
 * @param createClient Platform factory under test.
 * @param status HTTP status returned by the double.
 * @param body JSON body returned by the double.
 * @param access Service access stored on the client and copied onto the request.
 * @returns The request text, sent headers, and the completed output.
 */
async function exchange(
  createClient: OpenAIClientFactory,
  status: number,
  body: unknown,
  access: ServiceAccess = serviceAccess,
) {
  let requestText = "";
  let headers: ReadonlyArray<readonly [string, string]> = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (
    _input: unknown,
    init?: { body?: BodyInit | null; headers?: HeadersInit },
  ) => {
    requestText = await readRequestText(init?.body);
    headers = readRequestHeaders(init?.headers);
    return new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
  try {
    const client = createClient({ target, serviceAccess: access });
    const output = await client.interact(
      conversationRequest({
        target,
        messages: [{ role: "user", text: "Hello" }],
        serviceAccess: access,
      }),
    );
    return {
      requestText,
      headers,
      result: output.result as ConversationTaskResult,
      usage: output.usage,
      stopReason: output.stopReason,
    };
  } finally {
    globalThis.fetch = original;
  }
}

/**
 * Runs one chat stream against a canned SSE body.
 *
 * @param createClient Platform factory under test.
 * @param start Starts `stream` or `streamText` on the client.
 * @returns The wire flag, fragments, and assembled result.
 */
async function streamExchange(
  createClient: OpenAIClientFactory,
  start: (client: ReturnType<OpenAIClientFactory>) => TextStreamInteraction,
) {
  const original = globalThis.fetch;
  let requestText = "";
  const sse = [
    'data: {"choices":[{"index":0,"delta":{"content":"你"}}]}\n\n',
    'data: {"choices":[{"index":0,"delta":{"content":"好"},"finish_reason":"stop"}]}\n\n',
    "data: [DONE]\n\n",
  ].join("");
  globalThis.fetch = (async (_input: unknown, init?: { body?: BodyInit | null }) => {
    requestText = await readRequestText(init?.body);
    return new Response(new TextEncoder().encode(sse), {
      status: 200,
      headers: { "content-type": "text/event-stream" },
    });
  }) as typeof fetch;
  const client = createClient({ target, serviceAccess });
  try {
    const streamed = start(client);
    const fragments: string[] = [];
    for await (const event of streamed.events) {
      fragments.push(event.text);
    }
    const output = await streamed.output;
    return {
      wire: JSON.parse(requestText) as { stream?: boolean },
      fragments,
      result: output.result as ConversationTaskResult,
      stopReason: output.stopReason,
    };
  } finally {
    globalThis.fetch = original;
    await client.close();
  }
}

/**
 * Runs one chat interaction that the service rejects.
 *
 * @param createClient Platform factory under test.
 * @param status HTTP error status returned by the double.
 * @param body JSON error body returned by the double.
 * @returns The interaction error.
 */
async function rejectedExchange(createClient: OpenAIClientFactory, status: number, body: unknown) {
  const original = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    })) as typeof fetch;
  try {
    const client = createClient({ target, serviceAccess });
    await client.interact(
      conversationRequest({
        target,
        messages: [{ role: "user", text: "Hello" }],
        serviceAccess,
      }),
    );
    throw new Error("The chat exchange was expected to fail.");
  } catch (error) {
    if (error instanceof ModelInteractionError) {
      return error;
    }
    throw error;
  } finally {
    globalThis.fetch = original;
  }
}

/**
 * Finds one captured request header by its field name.
 *
 * @param headers Header pairs passed to Fetch.
 * @param name Lowercase field name to find.
 * @returns The field value, when that name was sent.
 */
function headerValue(
  headers: ReadonlyArray<readonly [string, string]>,
  name: string,
): string | undefined {
  return headers.find(([headerName]) => headerName === name)?.[1];
}

/**
 * Copies Fetch header init into ordered name and value pairs.
 *
 * @param headers Header init captured from the Fetch double.
 * @returns The pairs, or an empty list when Fetch omitted headers.
 */
function readRequestHeaders(
  headers: HeadersInit | undefined,
): ReadonlyArray<readonly [string, string]> {
  if (headers === undefined) {
    return [];
  }
  if (headers instanceof Headers) {
    return [...headers.entries()];
  }
  if (Array.isArray(headers)) {
    return headers.map(([name, value]) => [name, value]);
  }
  return Object.entries(headers);
}

/**
 * Reads the encoded request body captured by the Fetch double.
 *
 * @param body Body passed to Fetch.
 * @returns The request text, or an empty string when Fetch omitted a body.
 */
async function readRequestText(body: BodyInit | null | undefined): Promise<string> {
  if (body === undefined || body === null) {
    return "";
  }
  if (typeof body === "string") {
    return body;
  }
  if (body instanceof ArrayBuffer) {
    return new TextDecoder().decode(body);
  }
  if (ArrayBuffer.isView(body)) {
    return new TextDecoder().decode(body);
  }
  return "";
}
