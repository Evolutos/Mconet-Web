// Copyright © 2026 Mcont.

import {
  ModelInteractionError,
  projectConversationText,
  type ConversationTaskResult,
} from "@evolutos/mconet-core-domain";
import { expect, it } from "vitest";

import { conversationRequest } from "./conversation-request.js";
import { createOpenAICompatibleClient as createBrowserClient } from "./create-openai-compatible-client.js";
import { createOpenAICompatibleClient as createNodeClient } from "./node-client.js";

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

type OpenAIClientFactory = typeof createBrowserClient;

it("completes one chat exchange through the browser client", async () => {
  const output = await exchange(createBrowserClient, 200, successBody);
  expect(output.requestText).toContain("Hello");
  expect(projectConversationText(output.result)).toBe("hello");
  expect(output.usage).toEqual({
    inputTokens: 1,
    outputTokens: 2,
    totalTokens: 3,
    extensions: {},
  });
});

it("completes one chat exchange through the Node client", async () => {
  const output = await exchange(createNodeClient, 200, successBody);
  expect(projectConversationText(output.result)).toBe("hello");
  expect(output.usage).toMatchObject({ inputTokens: 1, outputTokens: 2, totalTokens: 3 });
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
 * @returns The request text and the completed output.
 */
async function exchange(createClient: OpenAIClientFactory, status: number, body: unknown) {
  let requestText = "";
  const original = globalThis.fetch;
  globalThis.fetch = (async (_input: unknown, init?: { body?: BodyInit | null }) => {
    requestText = await readRequestText(init?.body);
    return new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
  try {
    const client = createClient({ target, serviceAccess });
    const output = await client.interact(
      conversationRequest({
        target,
        messages: [{ role: "user", text: "Hello" }],
        serviceAccess,
      }),
    );
    return { requestText, result: output.result as ConversationTaskResult, usage: output.usage };
  } finally {
    globalThis.fetch = original;
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
