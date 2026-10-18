// Copyright © 2026 Mcont.

import {
  isParsedTaskResponse,
  ModelInteractionError,
  type ConversationTaskResult,
  type Extensions,
  type FinishReason,
  type ModelDescriptor,
  type OutputStatus,
  type ParsedTaskResponse,
  type ProcessingResult,
  type TokenUsage,
} from "@evolutos/mconet-core-domain";
import type { ErasedRuntimeValue, TransportResponseMetadata } from "@evolutos/mconet-core-spi";

import { OpenAIChatMessageResponseMapper } from "./openai-chat-message-response-mapper.js";
import { mapWireFinishReasonToDomain } from "./map-finish-reason.js";
import { mapWireModelToDomain } from "./map-resolved-model.js";
import { mapWireUsageToDomain } from "./map-token-usage.js";
import { OpenAIChatCompletionResponseDTO } from "./openai-chat-completion-response-dto.js";
import { OPENAI_CHAT_RESPONSE_TYPE_ID } from "./prepare-chat-completion-plan.js";

/** Stable code when transport metadata is not a success outcome. */
const unexpectedTransportOutcomeCode = "unexpected_transport_outcome";

/** Stable code when the payload is not a chat-completions success value. */
const invalidResponseTypeCode = "invalid_response_type";

/** Stable code when the success body cannot be read. */
const invalidResponsePayloadCode = "invalid_response_payload";

/** Stable code when choices do not share one finish reason. */
const ambiguousFinishReasonCode = "ambiguous_finish_reason";

/** Stable code when the mapped response misses a required parsed fact. */
const invalidParsedResponseCode = "invalid_parsed_response";

/** Task schema version written on every parsed conversation result. */
const taskDocumentVersion = "1.0";

/** Task type of a conversation generation result. */
const conversationGenerateTaskType = "conversation.generate";

/** Root identity of the task document. Message ids live in a separate document. */
const resultRootId = "result-root";

/** Root kind required by the task document contract. */
const taskRootKind = "task.root";

/** Container composition required on the task root. */
const containerComposition = "container";

/** Transport outcome that selects success parsing. Error outcomes stay out. */
const successOutcome = "success";

/**
 * Finish reasons with a standard output status.
 *
 * Any other reason stays the exact stop reason and uses status `unknown`.
 * The table does not rewrite the reason itself.
 */
const statusByFinishReason: Readonly<Record<string, OutputStatus>> = Object.freeze({
  stop: "completed",
  length: "incomplete",
  content_filter: "filtered",
  tool_calls: "requires_action",
  function_call: "requires_action",
});

/** Shared empty task-result metadata. */
const emptyMetadata: ConversationTaskResult["metadata"] = Object.freeze({});

/** Shared empty task-result extensions. Response extensions stay on the parsed response. */
const emptyResultExtensions: ConversationTaskResult["extensions"] = Object.freeze({});

/** Recovers message text and image parts. One instance is stateless. */
const messageResponseMapper = new OpenAIChatMessageResponseMapper();

/** Shared empty protocol state. A success body does not carry a service id. */
const emptyProtocolState: ParsedTaskResponse["protocolState"] = Object.freeze([]);

/**
 * Parses one decoded chat-completions success body into task-neutral facts.
 *
 * The result is a {@link ParsedTaskResponse}. This function does not construct
 * a model output, because an output also carries the request target and runtime
 * diagnostics, and neither is available here. It does not read a credential or
 * send a request.
 *
 * Every choice must report the same finish reason. One shared reason becomes
 * the stop reason, and a known reason also selects the output status. Differing
 * reasons fail instead of keeping an arbitrary choice. Omitted model and usage
 * stay omitted.
 *
 * @param input Decoded payload and the transport metadata that selected it.
 * @returns The parsed response, or error diagnostics and no value.
 */
export function parseOpenAIChatCompletionResponse(input: {
  readonly payload: ErasedRuntimeValue;
  readonly metadata: TransportResponseMetadata;
}): ProcessingResult<ParsedTaskResponse> {
  // Success parsing does not classify HTTP status. A non-success outcome belongs
  // to error parsing, so it is refused before the body is read.
  if (input.metadata?.outcome !== successOutcome) {
    return failure(
      unexpectedTransportOutcomeCode,
      "Chat completion success parsing requires a success transport outcome.",
      "metadata.outcome",
    );
  }
  if (input.payload?.typeId !== OPENAI_CHAT_RESPONSE_TYPE_ID) {
    return failure(
      invalidResponseTypeCode,
      "Payload is not a chat completion success value.",
      "payload.typeId",
    );
  }

  let response: OpenAIChatCompletionResponseDTO;
  try {
    response = readResponse(input.payload.value);
  } catch (error) {
    const rejected = thrownFailure(error);
    if (rejected !== undefined) {
      return rejected;
    }
    throw error;
  }

  let mapped: ReturnType<OpenAIChatMessageResponseMapper["mapResponse"]>;
  try {
    // The mapper recovers text and image parts together. Its catalog is the
    // one stored on the parsed response; a text-only body keeps that catalog empty.
    mapped = messageResponseMapper.mapResponse(input.payload);
  } catch (error) {
    const rejected = thrownFailure(error);
    if (rejected !== undefined) {
      return rejected;
    }
    throw error;
  }

  const finishReason = sharedFinishReason(response.choices);
  if (typeof finishReason !== "string") {
    return finishReason;
  }

  let stopReason: FinishReason;
  try {
    // The shared wire text is stored exactly. Status selection below does not
    // replace an unrecognized spelling with `unknown`.
    stopReason = mapWireFinishReasonToDomain(finishReason);
  } catch (error) {
    const rejected = thrownFailure(error);
    if (rejected !== undefined) {
      return rejected;
    }
    throw error;
  }

  const resolvedModel = mapReportedModel(response.model);
  if (resolvedModel.diagnostics !== undefined) {
    return { diagnostics: resolvedModel.diagnostics };
  }
  const usage = mapReportedUsage(response.usage);
  if (usage.diagnostics !== undefined) {
    return { diagnostics: usage.diagnostics };
  }

  const parsed = assembleResponse({
    messages: mapped.document,
    artifacts: mapped.artifacts,
    stopReason,
    status: statusForFinishReason(stopReason),
    extensions: response.extensions,
    ...(resolvedModel.model === undefined ? {} : { resolvedModel: resolvedModel.model }),
    ...(usage.usage === undefined ? {} : { usage: usage.usage }),
  });
  // Refuse a result that would not satisfy the parsed-response contract. The
  // check does not add a request target or runtime diagnostics.
  if (!isParsedTaskResponse(parsed)) {
    return failure(
      invalidParsedResponseCode,
      "Parsed chat completion response is incomplete.",
      "payload.value",
    );
  }
  return { diagnostics: [], value: parsed };
}

/** Optional facts copied only when the service reported them. */
interface ReportedFacts {
  readonly resolvedModel?: ModelDescriptor;
  readonly usage?: TokenUsage;
}

/**
 * Builds the parsed response around the conversation messages.
 *
 * The task document stays an empty root. The message tree is the authoritative
 * conversation output and is not copied into a task leaf.
 *
 * @param facts Messages, shared stop reason, status, and reported extras.
 * @returns A frozen parsed response.
 */
function assembleResponse(
  facts: ReportedFacts & {
    readonly messages: ConversationTaskResult["messages"];
    readonly artifacts: ConversationTaskResult["artifacts"];
    readonly stopReason: FinishReason;
    readonly status: OutputStatus;
    readonly extensions: Extensions;
  },
): ParsedTaskResponse {
  const result: ConversationTaskResult = Object.freeze({
    descriptor: Object.freeze({
      type: conversationGenerateTaskType,
      metadata: emptyMetadata,
      extensions: emptyResultExtensions,
    }),
    document: Object.freeze({
      version: taskDocumentVersion,
      root: Object.freeze({
        id: resultRootId,
        kind: taskRootKind,
        composition: containerComposition,
        children: Object.freeze([]),
        relations: Object.freeze([]),
        metadata: emptyMetadata,
        extensions: emptyResultExtensions,
      }),
      metadata: emptyMetadata,
      extensions: emptyResultExtensions,
    }),
    messages: facts.messages,
    artifacts: facts.artifacts,
    metadata: emptyMetadata,
    extensions: emptyResultExtensions,
  });
  // Copy optional members only when present so absence is not stored as null.
  const parsed: {
    result: ConversationTaskResult;
    status: OutputStatus;
    stopReason: FinishReason;
    protocolState: ParsedTaskResponse["protocolState"];
    extensions: Extensions;
    resolvedModel?: ModelDescriptor;
    usage?: TokenUsage;
  } = {
    result,
    status: facts.status,
    stopReason: facts.stopReason,
    protocolState: emptyProtocolState,
    extensions: facts.extensions,
  };
  if (facts.resolvedModel !== undefined) {
    parsed.resolvedModel = facts.resolvedModel;
  }
  if (facts.usage !== undefined) {
    parsed.usage = facts.usage;
  }
  return Object.freeze(parsed);
}

/**
 * Returns one response object, parsing plain JSON when the decoder left it plain.
 *
 * @param value Payload value.
 * @returns The response object.
 */
function readResponse(value: unknown): OpenAIChatCompletionResponseDTO {
  if (value instanceof OpenAIChatCompletionResponseDTO) {
    return value;
  }
  // The JSON encoder's counterpart may leave a plain object. Parse that shape
  // here so success parsing does not require the caller to construct the class.
  return OpenAIChatCompletionResponseDTO.fromJson(value);
}

/**
 * Returns the finish reason when every choice reports that same text.
 *
 * @param choices Choices in service order.
 * @returns The shared reason, or a failure when the choices disagree.
 */
function sharedFinishReason(
  choices: OpenAIChatCompletionResponseDTO["choices"],
): string | ProcessingResult<ParsedTaskResponse> {
  const first = choices[0];
  if (first === undefined) {
    // Choice aggregation reports an empty list itself. This branch only keeps
    // the helper total when that list was emptied after the check.
    return failure(ambiguousFinishReasonCode, "Chat completion choices are empty.", "choices");
  }
  for (const choice of choices) {
    // Exact text match. Different spellings are different reasons, including case.
    if (choice.finishReason !== first.finishReason) {
      return failure(
        ambiguousFinishReasonCode,
        "Chat completion choices report different finish reasons.",
        "choices.finish_reason",
      );
    }
  }
  return first.finishReason;
}

/**
 * Maps a known finish reason to a standard status.
 *
 * @param reason Exact stop reason.
 * @returns The standard status, or `unknown` when the reason has no standard status.
 */
function statusForFinishReason(reason: string): OutputStatus {
  return statusByFinishReason[reason] ?? "unknown";
}

/**
 * Maps a reported model, converting a thrown type error into diagnostics.
 *
 * @param model Response model text, or `undefined` when omitted.
 * @returns The descriptor, or diagnostics.
 */
function mapReportedModel(model: string | undefined): {
  readonly model?: ModelDescriptor;
  readonly diagnostics?: ProcessingResult<ParsedTaskResponse>["diagnostics"];
} {
  try {
    const mapped = mapWireModelToDomain(model);
    return mapped === undefined ? {} : { model: mapped };
  } catch (error) {
    const rejected = thrownFailure(error);
    if (rejected !== undefined) {
      return { diagnostics: rejected.diagnostics };
    }
    throw error;
  }
}

/**
 * Maps reported usage. Omission stays omission and is not a failure.
 *
 * @param usage Parsed usage, or `undefined` when the service omitted it.
 * @returns Domain usage, or diagnostics.
 */
function mapReportedUsage(usage: OpenAIChatCompletionResponseDTO["usage"]): {
  readonly usage?: TokenUsage;
  readonly diagnostics?: ProcessingResult<ParsedTaskResponse>["diagnostics"];
} {
  if (usage === undefined) {
    return {};
  }
  try {
    return { usage: mapWireUsageToDomain(usage) };
  } catch (error) {
    const rejected = thrownFailure(error);
    if (rejected !== undefined) {
      return { diagnostics: rejected.diagnostics };
    }
    throw error;
  }
}

/**
 * Converts a mapping failure into diagnostics.
 *
 * Wire type errors keep a fixed message so the rejected payload is not copied
 * into the diagnostic.
 *
 * @param error Thrown value.
 * @returns A processing failure, or `undefined` when the error is unexpected.
 */
function thrownFailure(error: unknown): ProcessingResult<ParsedTaskResponse> | undefined {
  if (error instanceof ModelInteractionError) {
    return {
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
  if (error instanceof TypeError || error instanceof RangeError) {
    return failure(
      invalidResponsePayloadCode,
      "Chat completion response payload is not usable.",
      "payload.value",
    );
  }
  return undefined;
}

/**
 * Returns a response-parsing failure with one error and no parsed value.
 *
 * @param code Stable diagnostic code.
 * @param message Technical summary that does not include payload text.
 * @param path Field that failed.
 * @returns A processing result without a value.
 */
function failure(
  code: string,
  message: string,
  path: string,
): ProcessingResult<ParsedTaskResponse> {
  return {
    diagnostics: [
      {
        code,
        severity: "error",
        phase: "response_parsing",
        message,
        path,
      },
    ],
  };
}
