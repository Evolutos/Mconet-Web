// Copyright © 2026 Mcont.

import type {
  CompatibilityPolicy,
  InteractionMode,
  MessageDocument,
  MessageEntry,
  ModelRequest,
} from "@evolutos/mconet-core-domain";
import type { ProtocolExecutionPlan } from "@evolutos/mconet-core-spi";

/** Compatibility mode used by the stable request fixture. */
export const openAIChatFixturePolicy: CompatibilityPolicy = { mode: "strict" };

/** Unary mode used by the stable request fixture. */
export const openAIChatFixtureMode: InteractionMode = { id: "unary" };

/**
 * Wire body the request fixture must produce.
 *
 * Optional sampling fields are absent. `stream` stays false.
 */
export const openAIChatFixtureRequestBody = Object.freeze({
  model: "fixture-model",
  messages: Object.freeze([
    Object.freeze({ role: "system", content: "guide" }),
    Object.freeze({ role: "user", content: "hello" }),
  ]),
  stream: false,
});

/** Execution plan the request fixture must produce. */
export const openAIChatFixturePlan: ProtocolExecutionPlan = {
  transportPlan: {
    endpoint: { kind: "absolute", value: "https://example.test/v1" },
    path: "/chat/completions",
    method: "POST",
    headers: [],
    query: [],
    authorization: { kind: "authorization.none" },
    transportExtensions: {},
  },
  payloadEncoder: { mediaType: { type: "application", subtype: "json", parameters: {} } },
  successDecoder: { mediaType: { type: "application", subtype: "json", parameters: {} } },
  errorDecoder: { mediaType: { type: "application", subtype: "json", parameters: {} } },
  transport: { requiredCapabilities: new Set<string>() },
  modeComponents: [],
  typeContract: {
    inputTypeId: "protocol.openai.chat-request",
    outputTypeId: "protocol.openai.chat-response",
  },
  extensions: {},
};

/**
 * Returns a fresh model request for the stable chat-completions fixture.
 *
 * Authorization has no credential source, so the fixture can be cloned and
 * planning cannot read a secret. Each call returns a new object graph.
 *
 * @returns The fixture request.
 */
export function createOpenAIChatFixtureRequest(): ModelRequest {
  return {
    target: {
      serviceId: "example",
      protocolId: "openai.chat.completions",
      model: { name: "fixture-model", metadata: {}, extensions: {} },
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
              id: "input",
              kind: "task.input.conversation",
              composition: "leaf",
              messages: messageDocument([
                entry("turn-1", "message.system", "guide"),
                entry("turn-2", "message.user", "hello"),
              ]),
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

/** Builds one message entry for the fixture conversation. */
function entry(id: string, roleId: string, text: string): MessageEntry {
  return {
    id,
    kind: "message.entry",
    role: { id: roleId, extensions: {} },
    content: [{ id: `${id}-text`, kind: "content.text", text, metadata: {}, extensions: {} }],
    relations: [],
    metadata: {},
    extensions: {},
  };
}

/** Builds the fixture message document. */
function messageDocument(children: MessageDocument["root"]["children"]): MessageDocument {
  return {
    version: "1.0",
    purpose: "input",
    root: {
      id: "message-root",
      kind: "message.root",
      composition: "container",
      children,
      relations: [],
      metadata: {},
      extensions: {},
    },
    metadata: {},
    extensions: {},
  };
}
