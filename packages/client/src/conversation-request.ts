// Copyright © 2026 Mcont.

import {
  ConversationTaskBuilder,
  ModelRequestBuilder,
  type JsonValue,
  type ModelRequest,
  type ModelTarget,
  type ServiceAccess,
  type ToolCall,
} from "@evolutos/mconet-core-domain";

/** Roles a text convenience message can name. Each maps to one standard role id. */
const messageRoleIds = {
  system: "message.system",
  user: "message.user",
  assistant: "message.assistant",
  tool: "message.tool",
} as const;

/**
 * One function the model may call.
 *
 * `parameters` is a JSON Schema object. This declaration has no implementation.
 */
export interface ConversationTool {
  /** Function name the model uses when it asks for this tool. */
  readonly name: string;

  /** Optional guidance shown to the model. */
  readonly description?: string;

  /** JSON Schema object describing the function arguments. */
  readonly parameters: JsonValue;
}

/** One text turn in a convenience conversation request. */
export interface ConversationMessage {
  /** Speaker of this turn. */
  readonly role: keyof typeof messageRoleIds;

  /** Text content of this turn. The helper does not interpret the characters. */
  readonly text: string;

  /** Call identity required when `role` is `tool`. */
  readonly toolCallId?: string;

  /** Function calls required when an assistant turn is asking for tools. */
  readonly toolCalls?: readonly ToolCall[];
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

  /**
   * Function tools declared for this request.
   *
   * Omission and an empty list both leave the tool member off the task. The
   * helper does not execute these declarations.
   */
  readonly tools?: readonly ConversationTool[];

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
  // The task builder validates turns, tool declarations, and message facts.
  // This function does not call a model.
  const task = new ConversationTaskBuilder(createDocument(input.messages, input.tools)).build();
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
 * @param tools Function declarations, omitted from the task when absent or empty.
 * @returns A task document for the conversation task builder.
 */
function createDocument(
  messages: readonly ConversationMessage[],
  tools: readonly ConversationTool[] | undefined,
) {
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
          // An empty list is omitted so the task matches a conversation that
          // declared no functions.
          ...(tools === undefined || tools.length === 0 ? {} : { tools }),
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
                // Tool facts stay off the entry when the caller omitted them.
                ...(message.toolCallId === undefined ? {} : { toolCallId: message.toolCallId }),
                ...(message.toolCalls === undefined ? {} : { toolCalls: message.toolCalls }),
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
