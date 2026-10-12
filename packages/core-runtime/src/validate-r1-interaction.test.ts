// Copyright © 2026 Mcont.

import type {
  ConversationTaskRequest,
  InteractionMode,
  ModelRequest,
  ModelTarget,
} from "@evolutos/mconet-core-domain";
import { expect, it, vi } from "vitest";

import { createInteractionContext } from "./interaction-context.js";
import { validateR1Interaction } from "./validate-r1-interaction.js";

const unary: InteractionMode = { id: "unary" };

function request(contentKind = "content.text"): ModelRequest {
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
                children: [
                  {
                    id: "turn-1",
                    kind: "message.entry",
                    role: { id: "message.user", extensions: {} },
                    content: [
                      {
                        id: "turn-1-content",
                        kind: contentKind,
                        text: "hello",
                        metadata: {},
                        extensions: {},
                      },
                    ],
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

it("passes a unary text request and does not call transport", () => {
  const send = vi.fn();
  const context = createInteractionContext({ request: request() });
  const validated = validateR1Interaction({ context, mode: unary });

  expect(send).not.toHaveBeenCalled();
  expect(validated.diagnostics).toEqual([]);
  expect(validated.value).toBe(context);
});

it("stops on a non-unary mode before reading artifacts", () => {
  const send = vi.fn();
  let artifactReads = 0;
  const source = request();
  Object.defineProperty(source.task, "artifacts", {
    configurable: true,
    get() {
      artifactReads += 1;
      throw new Error("artifacts read");
    },
  });
  const validated = validateR1Interaction({
    context: createInteractionContext({ request: source }),
    mode: { id: "stream" },
  });

  expect(send).not.toHaveBeenCalled();
  expect(artifactReads).toBe(0);
  expect(validated.value).toBeUndefined();
  expect(validated.diagnostics[0]?.code).toBe("unsupported_interaction_mode");
});

it("rejects non-text message content", () => {
  const validated = validateR1Interaction({
    context: createInteractionContext({ request: request("content.image") }),
    mode: unary,
  });

  expect(validated.value).toBeUndefined();
  expect(validated.diagnostics[0]?.code).toBe("unsupported_message_content");
});
