// Copyright © 2026 Mcont.

import {
  ConversationTaskBuilder,
  ModelRequestBuilder,
  type ModelRequest,
  type ModelTarget,
  type ServiceAccess,
} from "@evolutos/mconet-core-domain";

/** Roles a text convenience message can name. Each maps to one standard role id. */
const messageRoleIds = {
  system: "message.system",
  user: "message.user",
  assistant: "message.assistant",
} as const;

/** One text turn in a convenience conversation request. */
export interface ConversationMessage {
  /** Speaker of this turn. */
  readonly role: keyof typeof messageRoleIds;

  /** Text content of this turn. The helper does not interpret the characters. */
  readonly text: string;
}

/**
 * Inputs for one text conversation request.
 *
 * The target is required because a model request envelope always names one.
 * This helper does not read a client default, call a runtime, or send HTTP.
 */
export interface ConversationRequestInput {
  /** Service, protocol, and model selected for the request. */
  readonly target: ModelTarget;

  /** Ordered text turns. Order is the message-document order. */
  readonly messages: readonly ConversationMessage[];

  /** Optional unresolved access contribution copied onto the request. */
  readonly serviceAccess?: ServiceAccess;
}

/**
 * Builds one model request from text turns.
 *
 * The result is only the domain envelope. Task validation stays in the
 * conversation task builder, and envelope validation stays in the model request
 * builder. No interaction is started.
 *
 * @param input Target, text turns, and optional access.
 * @returns A validated model request.
 * @throws {TypeError} When the turns are not a supported conversation task.
 */
export function conversationRequest(input: ConversationRequestInput): ModelRequest {
  const task = new ConversationTaskBuilder(createDocument(input.messages)).build();
  const builder = new ModelRequestBuilder(input.target, task);
  if (input.serviceAccess !== undefined) {
    builder.withServiceAccess(input.serviceAccess);
  }
  return builder.build();
}

/**
 * Places each text turn in one conversation input leaf.
 *
 * Identifiers come from turn order so the same input builds the same tree.
 * The helper does not add generation parameters or a second task node.
 *
 * @param messages Ordered text turns.
 * @returns A task document for the conversation task builder.
 */
function createDocument(messages: readonly ConversationMessage[]) {
  return {
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
              children: messages.map((message, index) => ({
                id: `message-${index}`,
                kind: "message.entry" as const,
                role: { id: messageRoleIds[message.role], extensions: {} },
                content: [
                  {
                    id: `content-${index}`,
                    kind: "content.text" as const,
                    text: message.text,
                    metadata: {},
                    extensions: {},
                  },
                ],
                relations: [],
                metadata: {},
                extensions: {},
              })),
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
  };
}
