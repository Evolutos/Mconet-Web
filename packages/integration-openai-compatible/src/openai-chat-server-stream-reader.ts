// Copyright © 2026 Mcont.

import { ModelInteractionError, type JsonValue } from "@evolutos/mconet-core-domain";
import type { ErasedRuntimeValue, ServerStreamReader } from "@evolutos/mconet-core-spi";

import { OPENAI_CHAT_RESPONSE_TYPE_ID } from "./prepare-chat-completion-plan.js";

/** Reader name reported on the component descriptor. */
const readerName = "openai-chat-server-stream-reader";

/** Descriptive version of this reader. */
const readerVersion = "1.0.0";

/** Sentinel that ends an OpenAI chat event stream. */
const doneSentinel = "[DONE]";

/** Tool-call index used when an event omits one. */
const defaultToolCallIndex = 0;

/** Wire type written for a function call assembled from stream deltas. */
const functionToolType = "function";

/** Finish reason used when a stream ends on function calls and names no other reason. */
const toolCallsFinishReason = "tool_calls";

/** Finish reason used when a text stream ends without a reason. */
const stopFinishReason = "stop";

/** One function call assembled from stream deltas. */
interface AccumulatedToolCall {
  id?: string;
  name?: string;
  arguments: string;
}

/** One choice assembled from stream deltas. */
interface AccumulatedChoice {
  content: string;
  finishReason?: string;
  toolCalls: Map<number, AccumulatedToolCall>;
}

/**
 * Creates the reader that turns chat-completion events into one success value.
 *
 * A JSON body is accepted as well, so a buffered transport can still complete
 * a server-stream call. Event text is reported as it is decoded.
 *
 * @returns A stateless server-stream reader for chat completions.
 */
export function createOpenAIChatServerStreamReader(): ServerStreamReader {
  return {
    descriptor: Object.freeze({
      name: readerName,
      version: readerVersion,
      capabilities: new Set<string>(),
      source: "builtin" as const,
    }),
    read(input) {
      return readChatServerStream(input);
    },
  };
}

/**
 * Reads SSE or one JSON chat body into the success payload.
 *
 * @param input Frames, limits, and the optional text observer.
 * @returns The chat-completions success value.
 */
async function readChatServerStream(
  input: Parameters<ServerStreamReader["read"]>[0],
): Promise<ErasedRuntimeValue> {
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let pending = "";
  let mode: "unknown" | "json" | "sse" = "unknown";
  let totalBytes = 0;
  const choices = new Map<number, AccumulatedChoice>();
  let responseId: string | undefined;
  let model: string | undefined;
  let usage: JsonValue | undefined;

  const takeText = (text: string) => {
    if (text.length > 0) {
      input.onText?.(text);
    }
  };

  try {
    for await (const frame of input.frames) {
      if (input.signal.aborted) {
        throw cancelled();
      }
      totalBytes += frame.byteLength;
      if (totalBytes > input.maxBodyBytes) {
        throw bodyTooLarge();
      }
      pending += decoder.decode(frame, { stream: true });
      if (mode === "unknown") {
        const start = pending.trimStart();
        if (start.length === 0) {
          continue;
        }
        mode = start.startsWith("{") ? "json" : "sse";
      }
      if (mode === "sse") {
        const split = consumeLines(pending);
        pending = split.rest;
        for (const line of split.lines) {
          const step = applyEventLine(line, input.maxFrameBytes, choices, takeText);
          if (step.id !== undefined) {
            responseId = step.id;
          }
          if (step.model !== undefined) {
            model = step.model;
          }
          if (step.usage !== undefined) {
            usage = step.usage;
          }
        }
      }
    }
    pending += decoder.decode();
  } catch (error) {
    if (error instanceof ModelInteractionError) {
      throw error;
    }
    throw invalidStream();
  }

  if (mode === "sse") {
    const split = consumeLines(`${pending}\n`);
    for (const line of split.lines) {
      const step = applyEventLine(line, input.maxFrameBytes, choices, takeText);
      if (step.id !== undefined) {
        responseId = step.id;
      }
      if (step.model !== undefined) {
        model = step.model;
      }
      if (step.usage !== undefined) {
        usage = step.usage;
      }
    }
    return {
      typeId: OPENAI_CHAT_RESPONSE_TYPE_ID,
      value: completionValue(choices, responseId, model, usage),
    };
  }

  const parsed = parseJsonRecord(pending.trim());
  const content = readMessageContent(parsed);
  if (content !== undefined) {
    takeText(content);
  }
  return { typeId: OPENAI_CHAT_RESPONSE_TYPE_ID, value: parsed };
}

/** One parsed SSE data line. */
interface EventStep {
  readonly done?: boolean;
  readonly id?: string;
  readonly model?: string;
  readonly usage?: JsonValue;
}

/**
 * Applies one SSE line to the accumulated choices.
 *
 * @param line One physical line without its newline.
 * @param maxFrameBytes Maximum encoded size of one data line.
 * @param choices Choice text accumulated by index.
 * @param takeText Observer for a new fragment.
 * @returns Fields learned from the line.
 */
function applyEventLine(
  line: string,
  maxFrameBytes: number,
  choices: Map<number, AccumulatedChoice>,
  takeText: (text: string) => void,
): EventStep {
  const trimmed = line.endsWith("\r") ? line.slice(0, -1) : line;
  if (trimmed.length === 0 || trimmed.startsWith(":")) {
    return {};
  }
  if (!trimmed.startsWith("data:")) {
    return {};
  }
  if (lineByteLength(trimmed) > maxFrameBytes) {
    throw frameTooLarge();
  }
  const data = trimmed.slice("data:".length).trim();
  if (data === doneSentinel) {
    return { done: true };
  }
  const record = parseJsonRecord(data);
  if (isRecord(record.error)) {
    throw streamServiceError();
  }
  const id = typeof record.id === "string" ? record.id : undefined;
  const model = typeof record.model === "string" ? record.model : undefined;
  const usage = readUsage(record.usage);
  const choiceList = record.choices;
  if (Array.isArray(choiceList)) {
    for (const choice of choiceList) {
      if (!isRecord(choice)) {
        continue;
      }
      const index = typeof choice.index === "number" ? choice.index : defaultToolCallIndex;
      const current = choices.get(index) ?? emptyChoice();
      const delta = isRecord(choice.delta) ? choice.delta : undefined;
      const fragment = typeof delta?.content === "string" ? delta.content : undefined;
      if (fragment !== undefined && fragment.length > 0) {
        current.content += fragment;
        takeText(fragment);
      }
      // Function-call fragments are accumulated beside the text. A text-only
      // delta has no tool_calls member and leaves the call map unchanged.
      appendToolCallDeltas(current, delta?.tool_calls);
      const finish = choice.finish_reason;
      if (typeof finish === "string" && finish.length > 0) {
        current.finishReason = finish;
      }
      choices.set(index, current);
    }
  }
  return {
    ...(id === undefined ? {} : { id }),
    ...(model === undefined ? {} : { model }),
    ...(usage === undefined ? {} : { usage }),
  };
}

/**
 * Builds the non-stream chat body the success parser already accepts.
 *
 * @param choices Accumulated choice text.
 * @param id Response id when an event reported one.
 * @param model Model name when an event reported one.
 * @param usage Usage object when an event reported one.
 * @returns A JSON chat-completion object.
 */
function completionValue(
  choices: ReadonlyMap<number, AccumulatedChoice>,
  id: string | undefined,
  model: string | undefined,
  usage: JsonValue | undefined,
): JsonValue {
  const indexes = [...choices.keys()].sort((left, right) => left - right);
  if (indexes.length === 0) {
    indexes.push(defaultToolCallIndex);
  }
  const wireChoices: JsonValue[] = indexes.map((index) => {
    const choice = choices.get(index) ?? emptyChoice();
    const toolCalls = wireToolCalls(choice);
    const message: { [key: string]: JsonValue } = {
      role: "assistant",
      // An assistant turn that only requests tools is written with null content.
      content: toolCalls.length > 0 && choice.content.length === 0 ? null : choice.content,
    };
    if (toolCalls.length > 0) {
      message.tool_calls = toolCalls;
    }
    return {
      index,
      message,
      // A stream that produced calls but named no finish reason stopped for tools.
      finish_reason:
        choice.finishReason ?? (toolCalls.length > 0 ? toolCallsFinishReason : stopFinishReason),
    };
  });
  const body: { [key: string]: JsonValue } = { choices: wireChoices };
  if (id !== undefined) {
    body.id = id;
  }
  if (model !== undefined) {
    body.model = model;
  }
  if (usage !== undefined) {
    body.usage = usage;
  }
  return body;
}

/**
 * Returns one empty accumulated choice.
 *
 * Content starts empty and the call map starts with no indexes, so a text-only
 * stream does not invent a function call.
 */
function emptyChoice(): AccumulatedChoice {
  return { content: "", toolCalls: new Map() };
}

/**
 * Appends function-call fragments from one delta.
 *
 * Name and id arrive once. Argument text is concatenated in arrival order and
 * is not parsed. A missing index addresses the first call.
 *
 * @param choice Choice being assembled.
 * @param value Candidate `delta.tool_calls` member.
 */
function appendToolCallDeltas(choice: AccumulatedChoice, value: JsonValue | undefined): void {
  // A text delta omits tool_calls. That is not a request for a function.
  if (!Array.isArray(value)) {
    return;
  }
  for (const call of value) {
    // A non-object element cannot identify a function call.
    if (!isRecord(call)) {
      throw invalidStream();
    }
    const callIndex = readToolCallIndex(call);
    const current = choice.toolCalls.get(callIndex) ?? { arguments: "" };
    // Keep the first non-empty id. A later fragment must not replace it, and
    // an empty string is not an id a tool result can repeat.
    if (current.id === undefined && typeof call.id === "string" && call.id.length > 0) {
      current.id = call.id;
    }
    const functionValue = isRecord(call.function) ? call.function : undefined;
    if (
      current.name === undefined &&
      typeof functionValue?.name === "string" &&
      functionValue.name.length > 0
    ) {
      current.name = functionValue.name;
    }
    // Argument pieces are appended in arrival order, including an initial "".
    if (typeof functionValue?.arguments === "string") {
      current.arguments += functionValue.arguments;
    }
    choice.toolCalls.set(callIndex, current);
  }
}

/**
 * Reads the tool-call index from one delta object.
 *
 * @param call One `delta.tool_calls` element.
 * @returns A non-negative index. A missing index is the first call.
 */
function readToolCallIndex(call: { readonly [key: string]: JsonValue }): number {
  // Providers omit the index only when the delta contains the first call.
  if (!Object.hasOwn(call, "index")) {
    return defaultToolCallIndex;
  }
  const index = call.index;
  if (typeof index === "number" && Number.isSafeInteger(index) && index >= 0) {
    return index;
  }
  // A present but unusable index would otherwise collapse into call 0 and
  // concatenate a different function's arguments.
  throw invalidStream();
}

/**
 * Returns complete function calls in index order.
 *
 * A fragment that never received an id or a name cannot be answered. The
 * stream fails instead of omitting that call from the assembled message.
 *
 * @param choice Assembled choice.
 * @returns Wire function calls.
 */
function wireToolCalls(choice: AccumulatedChoice): JsonValue[] {
  const ordered = [...choice.toolCalls.entries()].sort((left, right) => left[0] - right[0]);
  const calls: JsonValue[] = [];
  for (const [, call] of ordered) {
    if (call.id === undefined || call.name === undefined) {
      throw invalidStream();
    }
    calls.push({
      id: call.id,
      type: functionToolType,
      function: { name: call.name, arguments: call.arguments },
    });
  }
  return calls;
}

/**
 * Splits complete lines from a buffer and keeps the incomplete tail.
 *
 * @param value Text received so far.
 * @returns Complete lines and the remainder.
 */
function consumeLines(value: string): { readonly lines: readonly string[]; readonly rest: string } {
  const lines: string[] = [];
  let start = 0;
  for (let index = 0; index < value.length; index += 1) {
    if (value.charCodeAt(index) === 10) {
      lines.push(value.slice(start, index));
      start = index + 1;
    }
  }
  return { lines, rest: value.slice(start) };
}

/**
 * Parses one JSON object.
 *
 * @param value JSON text.
 * @returns The object.
 */
function parseJsonRecord(value: string): { readonly [key: string]: JsonValue } {
  if (value.length === 0) {
    throw invalidStream();
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw invalidStream();
  }
  if (!isRecord(parsed)) {
    throw invalidStream();
  }
  return parsed;
}

/**
 * Reads assistant text from a non-stream chat body.
 *
 * @param value Decoded JSON object.
 * @returns The first choice message content, when it is text.
 */
function readMessageContent(value: { readonly [key: string]: JsonValue }): string | undefined {
  const choices = value.choices;
  if (!Array.isArray(choices) || !isRecord(choices[0])) {
    return undefined;
  }
  const message = choices[0].message;
  if (!isRecord(message) || typeof message.content !== "string") {
    return undefined;
  }
  return message.content;
}

/**
 * Copies the usage object when it contains finite token counts.
 *
 * @param value Candidate usage member.
 * @returns A JSON usage object, or undefined when nothing usable was present.
 */
function readUsage(value: JsonValue | undefined): JsonValue | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const usage: { [key: string]: JsonValue } = {};
  for (const key of ["prompt_tokens", "completion_tokens", "total_tokens"]) {
    const field = value[key];
    if (typeof field === "number" && Number.isFinite(field)) {
      usage[key] = field;
    }
  }
  return Object.keys(usage).length === 0 ? undefined : usage;
}

/**
 * Returns whether a JSON value is a plain object.
 *
 * @param value Candidate value.
 * @returns Whether the value is a JSON object.
 */
function isRecord(value: unknown): value is { readonly [key: string]: JsonValue } {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Counts UTF-8 bytes in one line.
 *
 * @param value Line text.
 * @returns Encoded length.
 */
function lineByteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

/** @returns Cancellation error. */
function cancelled(): ModelInteractionError {
  return new ModelInteractionError({
    message: "The interaction was cancelled.",
    category: "cancelled",
    phase: "transport",
    code: "cancelled",
    diagnostics: [],
  });
}

/** @returns Body-limit error. */
function bodyTooLarge(): ModelInteractionError {
  return new ModelInteractionError({
    message: "Response body exceeds its byte limit.",
    category: "invalid_request",
    phase: "transport",
    code: "response_body_too_large",
    diagnostics: [],
  });
}

/** @returns Frame-limit error. */
function frameTooLarge(): ModelInteractionError {
  return new ModelInteractionError({
    message: "A streaming event exceeds the frame byte limit.",
    category: "invalid_request",
    phase: "decoding",
    code: "streaming_frame_too_large",
    diagnostics: [],
  });
}

/** @returns Malformed-stream error. */
function invalidStream(): ModelInteractionError {
  return new ModelInteractionError({
    message: "The streaming response could not be read.",
    category: "deserialization",
    phase: "decoding",
    code: "invalid_response_payload",
    diagnostics: [],
  });
}

/** @returns Service-error event. */
function streamServiceError(): ModelInteractionError {
  return new ModelInteractionError({
    message: "The service returned an error while streaming.",
    category: "model_service",
    phase: "response_parsing",
    code: "stream_service_error",
    diagnostics: [],
  });
}
