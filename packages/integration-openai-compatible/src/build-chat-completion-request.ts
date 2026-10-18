// Copyright © 2026 Mcont.

import {
  ModelInteractionError,
  validateImageArtifactSupport,
  type CompatibilityPolicy,
  type ConversationInputNode,
  type GenerationParameters,
  type GenerationParametersNode,
  type ArtifactCatalog,
  type JsonValue,
  type MessageDocument,
  type ModelRequest,
  type ProcessingResult,
  type TaskGroupNode,
  type TaskNode,
  type ToolDeclaration,
} from "@evolutos/mconet-core-domain";
import type {
  ErasedRuntimeValue,
  MessageRequestMapper,
  ProtocolExecutionPlan,
  ProtocolRequestPlan,
} from "@evolutos/mconet-core-spi";

import { mapMaxOutputTokensToWire } from "./map-max-output-tokens.js";
import { mapMessageDocumentToWire } from "./map-message-document.js";
import { mapSeedToWire } from "./map-seed.js";
import { mapStopSequencesToWire } from "./map-stop-sequences.js";
import { mapTemperatureToWire } from "./map-temperature.js";
import { mapTopPToWire } from "./map-top-p.js";
import {
  openAIChatCompletionRequestJson,
  OpenAIChatCompletionRequestDTO,
} from "./openai-chat-completion-request-dto.js";
import type { OpenAIChatMessageDTO } from "./openai-chat-message-dto.js";
import { OPENAI_CHAT_REQUEST_TYPE_ID } from "./prepare-chat-completion-plan.js";

/** Stable code when the task tree has no conversation input. */
const missingConversationInputCode = "missing_conversation_input";

/** Stable code when mapped messages cannot form a request. */
const emptyProtocolMessagesCode = "empty_protocol_messages";

/** Stable code when an injected mapper does not return JSON messages. */
const invalidMessageDocumentCode = "invalid_message_document";

/** Stable code when two generation-parameter leaves are present. */
const duplicateGenerationParametersCode = "duplicate_generation_parameters";

/** Stable code when a task leaf has no chat-completions representation. */
const unsupportedTaskNodeCode = "unsupported_task_node";

/** Stable code when two declarations use the same function name. */
const duplicateToolDeclarationCode = "duplicate_tool_declaration";

/** Stable code when the selected model name is not text. */
const invalidModelNameCode = "invalid_model_name";

/** Conversation input leaf. Other leaves are not message sources. */
const conversationInputKind = "task.input.conversation";

/** Generation parameter leaf. */
const generationParametersKind = "task.configuration";

/** Container composition. Groups are walked; they are not themselves payload. */
const containerComposition = "container";

/**
 * Parameter mapping used while building a request.
 *
 * The execution plan does not carry a compatibility mode. Out-of-range sampling
 * values therefore fail here instead of being omitted or rewritten.
 */
const strictParameterPolicy: CompatibilityPolicy = { mode: "strict" };

/**
 * Builds the unencoded chat-completions request for one model request.
 *
 * The payload is the plain JSON object the later encoder will serialize. This
 * function does not stringify it, read a credential, authorize a header, or
 * send it. The supplied execution plan is returned by reference.
 *
 * An omitted `messageRequestMapper` keeps OpenAI `image_url` messages. A
 * supplied mapper replaces only that message list. This function does not
 * select Ollama or any other protocol from the model name.
 *
 * @param input Model request, the plan that governed this mapping, and the optional message mapper.
 * @returns The request plan, or error diagnostics and no payload.
 */
export function buildOpenAIChatCompletionRequest(input: {
  readonly request: ModelRequest;
  readonly plan: ProtocolExecutionPlan;
  readonly messageRequestMapper?: MessageRequestMapper;
}): ProcessingResult<ProtocolRequestPlan> {
  const artifactResult = validateImageArtifactSupport(
    input.request.task.document,
    input.request.task.artifacts,
  );
  if (artifactResult.value === undefined) {
    // Non-image artifacts and dangling references fail before sources are read.
    return { diagnostics: artifactResult.diagnostics };
  }

  const collected = collectTaskPayload(input.request.task.document.root);
  if (collected.diagnostics !== undefined) {
    return { diagnostics: collected.diagnostics };
  }
  if (collected.documents.length === 0) {
    return failure(
      missingConversationInputCode,
      "Conversation input is required.",
      "task.document",
    );
  }

  const mappedMessages = mapMessages(
    collected.documents,
    input.request.task.artifacts,
    input.messageRequestMapper,
  );
  if (mappedMessages.diagnostics !== undefined) {
    return { diagnostics: mappedMessages.diagnostics };
  }
  const messageCount =
    mappedMessages.wireMessages === undefined
      ? mappedMessages.messages.length
      : mappedMessages.wireMessages.length;
  if (messageCount === 0) {
    return failure(
      emptyProtocolMessagesCode,
      "Chat completions requires at least one message.",
      "messages",
    );
  }

  const modelName = input.request.target.model?.name;
  if (typeof modelName !== "string") {
    return failure(invalidModelNameCode, "Model name must be a string.", "target.model.name");
  }

  const options = mapGenerationOptions(collected.parameters);
  if (options.diagnostics !== undefined) {
    return { diagnostics: options.diagnostics };
  }

  const stream = input.plan.extensions?.stream === true;
  const requestFields = {
    ...options.options,
    // An empty declaration list is omitted. Writing `tools: []` would be a
    // different request from a conversation that declares no functions.
    ...(collected.tools.length === 0 ? {} : { tools: collected.tools }),
    ...(stream ? { stream: true } : {}),
  };
  // The default path still builds OpenAI message DTOs. An injected mapper has
  // already serialized its own message objects, so those replace the list.
  const requestBody =
    mappedMessages.wireMessages === undefined
      ? new OpenAIChatCompletionRequestDTO(
          modelName,
          mappedMessages.messages,
          requestFields,
        ).toJson()
      : openAIChatCompletionRequestJson({
          model: modelName,
          messages: mappedMessages.wireMessages,
          stream,
          ...options.options,
          ...(collected.tools.length === 0 ? {} : { tools: collected.tools }),
        });
  return {
    diagnostics: [],
    value: Object.freeze({
      payload: Object.freeze({
        typeId: OPENAI_CHAT_REQUEST_TYPE_ID,
        value: requestBody,
      }),
      executionPlan: input.plan,
    }),
  };
}

/** Narrows one task node to a conversation input leaf. */
function isConversationInput(node: TaskNode): node is ConversationInputNode {
  return node.kind === conversationInputKind && node.composition === "leaf";
}

/** Narrows one task node to a generation parameter leaf. */
function isGenerationParametersNode(node: TaskNode): node is GenerationParametersNode {
  return node.kind === generationParametersKind && node.composition === "leaf";
}

/** Narrows one task node to a container whose children are walked. */
function isTaskContainer(node: TaskNode): node is TaskGroupNode {
  return node.composition === containerComposition;
}

/** Task facts needed to build one chat request. */
interface CollectedTaskPayload {
  readonly documents: readonly MessageDocument[];
  readonly tools: readonly ToolDeclaration[];
  readonly parameters?: GenerationParameters;
  readonly diagnostics?: ProcessingResult<ProtocolRequestPlan>["diagnostics"];
}

/**
 * Walks a task tree in preorder and collects message documents and one parameter leaf.
 *
 * @param root Task document root.
 * @returns Collected facts, or diagnostics when a leaf cannot be represented.
 */
function collectTaskPayload(root: TaskNode): CollectedTaskPayload {
  const documents: MessageDocument[] = [];
  const tools: ToolDeclaration[] = [];
  const toolNames = new Set<string>();
  let parameters: GenerationParameters | undefined;
  const pending: TaskNode[] = [root];
  let node = pending.pop();
  while (node !== undefined) {
    if (isConversationInput(node)) {
      documents.push(node.messages);
      for (const tool of node.tools ?? []) {
        // Names are collected across every conversation input. A repeated name
        // would make the model's selection ambiguous.
        if (toolNames.has(tool.name)) {
          return {
            documents,
            tools,
            diagnostics: failure(
              duplicateToolDeclarationCode,
              "Each declared function name can appear only once.",
              "task.document",
            ).diagnostics,
          };
        }
        toolNames.add(tool.name);
        tools.push(tool);
      }
    } else if (isGenerationParametersNode(node)) {
      if (parameters !== undefined) {
        return {
          documents,
          tools,
          diagnostics: failure(
            duplicateGenerationParametersCode,
            "Only one generation parameter leaf can be mapped.",
            "task.document",
          ).diagnostics,
        };
      }
      parameters = node.parameters;
    } else if (isTaskContainer(node)) {
      // Reverse a shallow copy so the stack restores left-to-right child order.
      for (const child of node.children.slice().reverse()) {
        pending.push(child);
      }
    } else {
      return {
        documents,
        tools,
        diagnostics: failure(
          unsupportedTaskNodeCode,
          "Task leaf is not supported by the chat completions request.",
          "task.document",
        ).diagnostics,
      };
    }
    node = pending.pop();
  }
  return parameters === undefined ? { documents, tools } : { documents, tools, parameters };
}

/** Messages for one chat body, either as OpenAI DTOs or as injected JSON. */
interface MappedMessages {
  readonly messages: readonly OpenAIChatMessageDTO[];

  /** Present only when an injected mapper supplied the message list. */
  readonly wireMessages?: readonly JsonValue[];

  readonly diagnostics?: ProcessingResult<ProtocolRequestPlan>["diagnostics"];
}

/**
 * Maps every conversation document into the message list for one request.
 *
 * Without an injected mapper, each document becomes OpenAI chat messages.
 * With one, the mapper's fragment replaces that list. A thrown protocol error
 * becomes a diagnostic and no partial body is returned.
 *
 * @param documents Conversation inputs in send order.
 * @param catalog Catalog that resolves image references.
 * @param messageRequestMapper Optional replacement for the OpenAI message list.
 * @returns Mapped messages, or diagnostics when mapping fails.
 */
function mapMessages(
  documents: readonly MessageDocument[],
  catalog: ArtifactCatalog,
  messageRequestMapper: MessageRequestMapper | undefined,
): MappedMessages {
  // Omission keeps the general OpenAI message list, including image_url parts.
  // Injection replaces that list only. Model, tools, and sampling stay here,
  // and this builder does not choose a protocol from the model name.
  if (messageRequestMapper === undefined) {
    const messages: OpenAIChatMessageDTO[] = [];
    for (const document of documents) {
      try {
        for (const message of mapMessageDocumentToWire(document, catalog)) {
          messages.push(message);
        }
      } catch (error) {
        const diagnostics = mappingFailure(error);
        if (diagnostics !== undefined) {
          return { messages: [], diagnostics };
        }
        throw error;
      }
    }
    return { messages };
  }

  const wireMessages: JsonValue[] = [];
  for (const document of documents) {
    let fragment: ErasedRuntimeValue;
    try {
      fragment = messageRequestMapper.mapRequest(document, catalog);
    } catch (error) {
      const diagnostics = mappingFailure(error);
      if (diagnostics !== undefined) {
        return { messages: [], diagnostics };
      }
      throw error;
    }
    // Copy the fragment into JSON so the request body does not share objects
    // with the mapper. A non-JSON fragment fails closed instead of being sent.
    const copied = copyJsonMessages(fragment.value);
    if (copied === undefined) {
      return {
        messages: [],
        diagnostics: failure(
          invalidMessageDocumentCode,
          "Injected message mapper must return JSON message objects.",
          "messages",
        ).diagnostics,
      };
    }
    for (const message of copied) {
      wireMessages.push(message);
    }
  }
  return { messages: [], wireMessages };
}

/**
 * Copies a mapper fragment when it is a JSON array of message objects.
 *
 * @param value Fragment `value` from an injected mapper.
 * @returns Detached JSON messages, or `undefined` when the fragment is not that list.
 */
function copyJsonMessages(value: unknown): readonly JsonValue[] | undefined {
  // Stringify and parse detaches the fragment and rejects values JSON cannot
  // carry. Each element must be a message object, not a string or array.
  let encoded: string;
  try {
    encoded = JSON.stringify(value);
  } catch {
    return undefined;
  }
  if (typeof encoded !== "string") {
    return undefined;
  }
  const parsed: unknown = JSON.parse(encoded);
  if (!Array.isArray(parsed)) {
    return undefined;
  }
  for (const item of parsed) {
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      return undefined;
    }
  }
  return parsed as JsonValue[];
}

/**
 * Converts a mapping throw into diagnostics.
 *
 * @param error Value thrown by a message mapper.
 * @returns Diagnostics for a protocol error, or `undefined` when the caller should rethrow.
 */
function mappingFailure(
  error: unknown,
): ProcessingResult<ProtocolRequestPlan>["diagnostics"] | undefined {
  // Only a protocol error becomes a diagnostic. Any other throw is a defect
  // and must not be rewritten into a partial request.
  if (!(error instanceof ModelInteractionError)) {
    return undefined;
  }
  return [
    {
      code: error.code,
      severity: "error",
      phase: error.phase,
      message: error.message,
    },
  ];
}

/** Optional request members accepted by the chat-completions body. */
interface RequestOptions {
  readonly temperature?: number;
  readonly topP?: number;
  readonly maxTokens?: number;
  readonly stop?: readonly string[];
  readonly seed?: number;
  readonly stream?: boolean;
}

/**
 * Maps generation controls onto request options.
 *
 * Absent controls stay absent. The first failing control stops the mapping.
 *
 * @param parameters Generation controls, or `undefined` when the task has none.
 * @returns Options, or diagnostics when a control cannot be sent.
 */
function mapGenerationOptions(parameters: GenerationParameters | undefined): {
  readonly options: RequestOptions;
  readonly diagnostics?: ProcessingResult<ProtocolRequestPlan>["diagnostics"];
} {
  if (parameters === undefined) {
    return { options: {} };
  }

  const temperature = mapTemperatureToWire(parameters.temperature, strictParameterPolicy);
  if (temperature.value === undefined) {
    return { options: {}, diagnostics: temperature.diagnostics };
  }
  const topP = mapTopPToWire(parameters.topP, strictParameterPolicy);
  if (topP.value === undefined) {
    return { options: {}, diagnostics: topP.diagnostics };
  }
  const maxTokens = mapMaxOutputTokensToWire(parameters.maxOutputTokens);
  if (maxTokens.value === undefined) {
    return { options: {}, diagnostics: maxTokens.diagnostics };
  }
  const stop = mapStopSequencesToWire(parameters.stop);
  if (stop.value === undefined) {
    return { options: {}, diagnostics: stop.diagnostics };
  }
  const seed = mapSeedToWire(parameters.seed);
  if (seed.value === undefined) {
    return { options: {}, diagnostics: seed.diagnostics };
  }

  // Copy only members that are present so an omitted control is not stored as null.
  const options: {
    temperature?: number;
    topP?: number;
    maxTokens?: number;
    stop?: readonly string[];
    seed?: number;
  } = {};
  if (temperature.value.temperature !== undefined) {
    options.temperature = temperature.value.temperature;
  }
  if (topP.value.topP !== undefined) {
    options.topP = topP.value.topP;
  }
  if (maxTokens.value.maxTokens !== undefined) {
    options.maxTokens = maxTokens.value.maxTokens;
  }
  if (stop.value.stop !== undefined) {
    options.stop = stop.value.stop;
  }
  if (seed.value.seed !== undefined) {
    options.seed = seed.value.seed;
  }
  return { options };
}

/**
 * Returns a request-building failure with one error and no payload.
 *
 * @param code Stable diagnostic code.
 * @param message Technical summary that does not include secrets or message text.
 * @param path Field that failed.
 * @returns A processing result without a value.
 */
function failure(
  code: string,
  message: string,
  path: string,
): ProcessingResult<ProtocolRequestPlan> {
  return {
    diagnostics: [
      {
        code,
        severity: "error",
        phase: "planning",
        message,
        path,
      },
    ],
  };
}
