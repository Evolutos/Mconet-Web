// Copyright © 2026 Mcont.

import type {
  ConversationTaskRequest,
  ModelRequest,
  ModelTarget,
} from "@evolutos/mconet-core-domain";
import { expect, it } from "vitest";

import { createInteractionContext } from "./interaction-context.js";
import { normalizeInteractionRequest } from "./normalize-interaction-request.js";

function request(): ModelRequest {
  const target: ModelTarget = {
    serviceId: "service.vendor",
    protocolId: "protocol.vendor",
    model: { name: "model-a", metadata: {}, extensions: {} },
    extensions: {},
  };
  const task: ConversationTaskRequest = {
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
  };
  return { target, task, metadata: {}, extensions: {} };
}

it("returns a frozen request envelope and does not rewrite or read a credential", () => {
  let credentialReads = 0;
  const source = request();
  const withAccess = {
    ...source,
    serviceAccess: {
      headers: [],
      query: [],
      extensions: {},
      authorization: {
        kind: "authorization.bearer",
        credentialSource: {
          getCredential(): never {
            credentialReads += 1;
            throw new Error("credential read");
          },
        },
      },
    },
  } as ModelRequest;
  const signal = new AbortController().signal;
  const context = createInteractionContext({ request: withAccess, options: { signal } });
  const normalized = normalizeInteractionRequest(context);

  expect(credentialReads).toBe(0);
  expect(normalized.diagnostics).toEqual([]);
  expect(normalized.value?.request).not.toBe(withAccess);
  expect(normalized.value?.request).toEqual(withAccess);
  expect(normalized.value?.request.target).toBe(withAccess.target);
  expect(Object.isFrozen(normalized.value?.request)).toBe(true);
  expect(normalized.value?.options.signal).toBe(signal);
  expect(normalized.value).not.toBe(context);
});

it("returns no request when the envelope is not a model request", () => {
  const context = createInteractionContext({
    request: { metadata: {}, extensions: {} } as ModelRequest,
  });
  const normalized = normalizeInteractionRequest(context);

  expect(normalized.value).toBeUndefined();
  expect(normalized.diagnostics[0]?.code).toBe("invalid_model_request");
});
