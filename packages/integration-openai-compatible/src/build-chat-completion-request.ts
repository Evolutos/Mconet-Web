// Copyright © 2026 Mcont.

import {
  ModelInteractionError,
  validateEmptyArtifactCatalogSupport,
  type CompatibilityPolicy,
  type ConversationInputNode,
  type GenerationParameters,
  type GenerationParametersNode,
  type MessageDocument,
  type ModelRequest,
  type ProcessingResult,
  type TaskGroupNode,
  type TaskNode,
} from "@evolutos/mconet-core-domain";
import type { ProtocolExecutionPlan, ProtocolRequestPlan } from "@evolutos/mconet-core-spi";

import { mapMaxOutputTokensToWire } from "./map-max-output-tokens.js";
import { mapMessageDocumentToWire } from "./map-message-document.js";
import { mapSeedToWire } from "./map-seed.js";
import { mapStopSequencesToWire } from "./map-stop-sequences.js";
import { mapTemperatureToWire } from "./map-temperature.js";
import { mapTopPToWire } from "./map-top-p.js";
import { OpenAIChatCompletionRequestDTO } from "./openai-chat-completion-request-dto.js";
import type { OpenAIChatMessageDTO } from "./openai-chat-message-dto.js";
import { OPENAI_CHAT_REQUEST_TYPE_ID } from "./prepare-chat-completion-plan.js";

/** Stable code when the task tree has no conversation input. */
const missingConversationInputCode = "missing_conversation_input";

/** Stable code when mapped messages cannot form a request. */
const emptyProtocolMessagesCode = "empty_protocol_messages";

/** Stable code when two generation-parameter leaves are present. */
const duplicateGenerationParametersCode = "duplicate_generation_parameters";

/** Stable code when a task leaf has no chat-completions representation. */
const unsupportedTaskNodeCode = "unsupported_task_node";

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
 * @param input Model request and the plan that governed this mapping.
 * @returns The request plan, or error diagnostics and no payload.
 */
export function buildOpenAIChatCompletionRequest(input: {
  readonly request: ModelRequest;
  readonly plan: ProtocolExecutionPlan;
}): ProcessingResult<ProtocolRequestPlan> {
  const artifactResult = validateEmptyArtifactCatalogSupport(input.request.task.artifacts);
  if (artifactResult.value === undefined) {
    // Artifacts are unsupported on this path. Return the domain diagnostic
    // without reading artifact sources.
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

  const messages: OpenAIChatMessageDTO[] = [];
  for (const document of collected.documents) {
    const mapped = mapDocument(document);
    if (mapped.diagnostics !== undefined) {
      return { diagnostics: mapped.diagnostics };
    }
    for (const message of mapped.messages) {
      messages.push(message);
    }
  }
  if (messages.length === 0) {
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

  const stream = input.plan.extensions.stream === true;
  const requestBody = new OpenAIChatCompletionRequestDTO(modelName, messages, {
    ...options.options,
    ...(stream ? { stream: true } : {}),
  }).toJson();
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
  let parameters: GenerationParameters | undefined;
  const pending: TaskNode[] = [root];
  let node = pending.pop();
  while (node !== undefined) {
    if (isConversationInput(node)) {
      documents.push(node.messages);
    } else if (isGenerationParametersNode(node)) {
      if (parameters !== undefined) {
        return {
          documents,
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
        diagnostics: failure(
          unsupportedTaskNodeCode,
          "Task leaf is not supported by the chat completions request.",
          "task.document",
        ).diagnostics,
      };
    }
    node = pending.pop();
  }
  return parameters === undefined ? { documents } : { documents, parameters };
}

/**
 * Maps one message document, converting a thrown protocol error into diagnostics.
 *
 * @param document Conversation input document.
 * @returns Mapped messages, or diagnostics when mapping fails.
 */
function mapDocument(document: MessageDocument): {
  readonly messages: readonly OpenAIChatMessageDTO[];
  readonly diagnostics?: ProcessingResult<ProtocolRequestPlan>["diagnostics"];
} {
  try {
    return { messages: mapMessageDocumentToWire(document) };
  } catch (error) {
    if (error instanceof ModelInteractionError) {
      return {
        messages: [],
        diagnostics: [
          {
            code: error.code,
            severity: "error",
            phase: error.phase,
            message: error.message,
          },
        ],
      };
    }
    throw error;
  }
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
