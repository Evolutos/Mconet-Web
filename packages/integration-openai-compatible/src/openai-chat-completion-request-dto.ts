// Copyright © 2026 Mcont.

import type { JsonValue, ToolDeclaration } from "@evolutos/mconet-core-domain";

import { OpenAIChatMessageDTO } from "./openai-chat-message-dto.js";

/** Wire value named in construction failures. */
const requestOwner = "OpenAIChatCompletionRequestDTO";

/** Failure used when a sampling number cannot survive JSON encoding. */
const jsonFiniteNumberMessage = "JSON floating-point value must be finite.";

/** Failure used when a number would lose its sign in JSON. */
const jsonNegativeZeroMessage = "JSON number must not be negative zero.";

/** Failure used when an integer is outside the binary64 safe range. */
const jsonSafeIntegerMessage = "JSON integer must be within the interoperable safe range.";

/** Wire type written for every declared function tool. */
const functionToolType = "function";

/**
 * Optional request members. Each field is omitted from the body when absent.
 *
 * The type stays module-private so this step publishes one wire value.
 */
interface OpenAIChatCompletionRequestOptions {
  /** Sampling temperature, or omitted to leave the service default. */
  readonly temperature?: number;

  /** Nucleus sampling mass, or omitted to leave the service default. */
  readonly topP?: number;

  /** Output token limit, or omitted to leave the service default. */
  readonly maxTokens?: number;

  /** Stop sequences in order, or omitted to leave the service default. */
  readonly stop?: readonly string[];

  /** Deterministic sampling seed, or omitted to leave the service default. */
  readonly seed?: number;

  /** When true, the service responds with server-sent events. Omission means false. */
  readonly stream?: boolean;

  /** Function tools the model may call. Omission leaves the service without tools. */
  readonly tools?: readonly ToolDeclaration[];
}

/**
 * Holds the complete chat-completion request body before payload encoding.
 *
 * Optional members are absent when the request does not send them, so the
 * service default applies. `stream` defaults to `false`. `true` asks the
 * service for a server-sent event response. The value carries no other
 * member, because the request profile forbids unknown members.
 */
export class OpenAIChatCompletionRequestDTO {
  /** Provider-facing model name sent exactly as configured. */
  public readonly model: string;

  /** Conversation messages in send order. */
  public readonly messages: readonly OpenAIChatMessageDTO[];

  /** Sampling temperature when the request sends one. */
  public readonly temperature?: number;

  /** Nucleus sampling mass when the request sends one. */
  public readonly topP?: number;

  /** Output token limit when the request sends one. */
  public readonly maxTokens?: number;

  /** Stop sequences in order when the request sends them. */
  public readonly stop?: readonly string[];

  /** Deterministic sampling seed when the request sends one. */
  public readonly seed?: number;

  /** Whether the service should stream events. Defaults to false. */
  public readonly stream: boolean;

  /** Function tools when the request declares them. */
  public readonly tools?: readonly ToolDeclaration[];

  /**
   * Creates one request from the model, messages, and any optional members.
   *
   * @param model Provider-facing model name.
   * @param messages Conversation messages in send order.
   * @param options Optional members. An omitted field is not written as null.
   */
  public constructor(
    model: string,
    messages: readonly OpenAIChatMessageDTO[],
    options: OpenAIChatCompletionRequestOptions = {},
  ) {
    if (typeof model !== "string") {
      throw new TypeError(`${requestOwner} model must be a string.`);
    }
    if (!isPlainOptions(options)) {
      throw new TypeError(`${requestOwner} options must be an object.`);
    }

    this.model = model;
    // Copy the message list so later caller mutation cannot change send order.
    this.messages = copyMessages(messages);

    const temperature = requireOptionalNumber(options.temperature, "temperature");
    const topP = requireOptionalNumber(options.topP, "topP");
    const maxTokens = requireOptionalInteger(options.maxTokens, "maxTokens");
    const seed = requireOptionalInteger(options.seed, "seed");
    const stop = copyStop(options.stop);
    // Assign only supplied members so an omitted control stays absent rather than
    // becoming an own undefined property.
    if (temperature !== undefined) {
      this.temperature = temperature;
    }
    if (topP !== undefined) {
      this.topP = topP;
    }
    if (maxTokens !== undefined) {
      this.maxTokens = maxTokens;
    }
    if (stop !== undefined) {
      this.stop = stop;
    }
    if (seed !== undefined) {
      this.seed = seed;
    }
    this.stream = requireOptionalStream(options.stream);
    const tools = copyTools(options.tools);
    if (tools !== undefined) {
      this.tools = tools;
    }
    Object.freeze(this);
  }

  /**
   * Returns the request body members in frozen profile order.
   *
   * Omitted optional members are absent rather than null. `stream` is false
   * unless the caller set it.
   *
   * @returns A fresh JSON object.
   */
  public toJson(): { readonly [key: string]: JsonValue } {
    // Insertion order follows the frozen profile so the encoded bytes are stable
    // for the same request. Optional members are included only when present.
    return openAIChatCompletionRequestJson({
      model: this.model,
      messages: this.messages.map((message) => message.toJson()),
      stream: this.stream,
      ...(this.tools === undefined ? {} : { tools: this.tools }),
      ...(this.temperature === undefined ? {} : { temperature: this.temperature }),
      ...(this.topP === undefined ? {} : { topP: this.topP }),
      ...(this.maxTokens === undefined ? {} : { maxTokens: this.maxTokens }),
      ...(this.stop === undefined ? {} : { stop: this.stop }),
      ...(this.seed === undefined ? {} : { seed: this.seed }),
    });
  }
}

/**
 * Request fields composed around an already-serialized message list.
 *
 * The message list comes from the chat DTO or from an injected message mapper.
 * These fields do not select a protocol.
 */
export interface OpenAIChatCompletionJsonInput {
  /** Provider-facing model name. */
  readonly model: string;

  /** Messages already serialized for the request body, in send order. */
  readonly messages: readonly JsonValue[];

  /** Whether the service should stream events. */
  readonly stream: boolean;

  /** Sampling temperature when the request sends one. */
  readonly temperature?: number;

  /** Nucleus sampling mass when the request sends one. */
  readonly topP?: number;

  /** Output token limit when the request sends one. */
  readonly maxTokens?: number;

  /** Stop sequences in order when the request sends them. */
  readonly stop?: readonly string[];

  /** Deterministic sampling seed when the request sends one. */
  readonly seed?: number;

  /** Function tools when the request declares them. */
  readonly tools?: readonly ToolDeclaration[];
}

/**
 * Returns the chat-completions body in frozen profile order.
 *
 * Omitted optional members are absent rather than null. `stream` is always
 * written. The message array is copied by reference into a fresh body object;
 * callers pass a list they already own.
 *
 * @param input Model, messages, stream flag, and any optional members.
 * @returns A fresh JSON object.
 */
export function openAIChatCompletionRequestJson(input: OpenAIChatCompletionJsonInput): {
  readonly [key: string]: JsonValue;
} {
  const body: { [key: string]: JsonValue } = {
    model: input.model,
    messages: [...input.messages],
  };
  if (input.tools !== undefined) {
    body.tools = input.tools.map((tool) => ({
      type: functionToolType,
      function: {
        name: tool.name,
        ...(tool.description === undefined ? {} : { description: tool.description }),
        parameters: tool.parameters,
      },
    }));
  }
  if (input.temperature !== undefined) {
    body.temperature = input.temperature;
  }
  if (input.topP !== undefined) {
    body.top_p = input.topP;
  }
  if (input.maxTokens !== undefined) {
    body.max_tokens = input.maxTokens;
  }
  if (input.stop !== undefined) {
    body.stop = [...input.stop];
  }
  if (input.seed !== undefined) {
    body.seed = input.seed;
  }
  body.stream = input.stream;
  return body;
}

/**
 * Returns whether the options bag is a plain object the constructor can read.
 *
 * @param value Candidate options value.
 * @returns Whether the value is an ordinary object.
 */
function isPlainOptions(value: unknown): value is object {
  // Null and arrays are objects in JavaScript but are not an options record.
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/**
 * Copies a non-empty message list and rejects any other collection shape.
 *
 * @param value Candidate message list.
 * @returns A frozen list in the caller's order.
 */
function copyMessages(value: readonly OpenAIChatMessageDTO[]): readonly OpenAIChatMessageDTO[] {
  // Arrays are the JavaScript equivalent of the wire tuple: order is significant
  // and the stored list must not remain shared with the caller.
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) {
    throw new TypeError(`${requestOwner} messages must be an array.`);
  }
  if (value.length === 0) {
    throw new RangeError(`${requestOwner} messages must not be empty.`);
  }

  const copy: OpenAIChatMessageDTO[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const item = value[index];
    if (!(item instanceof OpenAIChatMessageDTO)) {
      throw new TypeError(`${requestOwner} messages must contain OpenAIChatMessageDTO values.`);
    }
    copy.push(item);
  }
  return Object.freeze(copy);
}

/**
 * Copies stop sequences, or returns undefined when the member is omitted.
 *
 * An empty array would still send the member, which is not the same request as
 * omitting it. Undefined is the only way to omit it.
 *
 * @param value Candidate stop list.
 * @returns A frozen non-empty list, or undefined when the member is omitted.
 */
function copyStop(value: readonly string[] | undefined): readonly string[] | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) {
    throw new TypeError(`${requestOwner} stop must be an array or undefined.`);
  }
  if (value.length === 0) {
    throw new RangeError(`${requestOwner} stop must not be empty; use undefined to omit it.`);
  }

  const copy: string[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const item = value[index];
    if (typeof item !== "string") {
      throw new TypeError(`${requestOwner} stop must contain only strings.`);
    }
    copy.push(item);
  }
  return Object.freeze(copy);
}

/**
 * Returns one optional JSON number, or undefined when the member is omitted.
 *
 * @param value Candidate number.
 * @param name Public field name used in the failure.
 * @returns The portable number, or undefined.
 */
/**
 * Reads the optional stream flag.
 *
 * Omission means a single JSON response. Any other value is rejected.
 *
 * @param value Candidate stream flag.
 * @returns The flag to write on the request.
 */
/**
 * Copies function declarations, or returns undefined when they are omitted.
 *
 * An empty list is not the same request as omitting tools, so it is rejected.
 *
 * @param value Candidate declaration list.
 * @returns A frozen non-empty list, or undefined when the member is omitted.
 */
function copyTools(
  value: readonly ToolDeclaration[] | undefined,
): readonly ToolDeclaration[] | undefined {
  // Omission leaves tools off the request body.
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) {
    throw new TypeError(`${requestOwner} tools must be an array or undefined.`);
  }
  // An empty list is a different request from omitting tools, so it is rejected.
  if (value.length === 0) {
    throw new RangeError(`${requestOwner} tools must not be empty; use undefined to omit them.`);
  }
  const copy: ToolDeclaration[] = [];
  const names = new Set<string>();
  for (const tool of value) {
    if (
      typeof tool !== "object" ||
      tool === null ||
      typeof tool.name !== "string" ||
      tool.name.length === 0 ||
      (tool.description !== undefined && typeof tool.description !== "string") ||
      typeof tool.parameters !== "object" ||
      tool.parameters === null ||
      Array.isArray(tool.parameters)
    ) {
      throw new TypeError(`${requestOwner} tools must contain a name and parameter object.`);
    }
    // The model selects a function by name, so the list cannot contain two.
    if (names.has(tool.name)) {
      throw new TypeError(`${requestOwner} tools must not repeat a function name.`);
    }
    names.add(tool.name);
    copy.push({
      name: tool.name,
      ...(tool.description === undefined ? {} : { description: tool.description }),
      parameters: tool.parameters,
    });
  }
  return Object.freeze(copy);
}

function requireOptionalStream(value: unknown): boolean {
  if (value === undefined) {
    return false;
  }
  if (typeof value !== "boolean") {
    throw new TypeError(`${requestOwner} stream must be a boolean.`);
  }
  return value;
}

function requireOptionalNumber(value: unknown, name: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  // Booleans are a different JSON kind and must not be sent as numbers.
  if (typeof value !== "number") {
    throw new TypeError(`${requestOwner} ${name} must be a number or undefined.`);
  }
  if (!Number.isFinite(value)) {
    throw new RangeError(jsonFiniteNumberMessage);
  }
  if (Object.is(value, -0)) {
    throw new RangeError(jsonNegativeZeroMessage);
  }
  return value;
}

/**
 * Returns one optional safe integer, or undefined when the member is omitted.
 *
 * @param value Candidate integer.
 * @param name Public field name used in the failure.
 * @returns The portable integer, or undefined.
 */
function requireOptionalInteger(value: unknown, name: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  // Fractional numbers and non-numbers are different JSON kinds from integers.
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new TypeError(`${requestOwner} ${name} must be an integer or undefined.`);
  }
  if (Object.is(value, -0)) {
    throw new RangeError(jsonNegativeZeroMessage);
  }
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(jsonSafeIntegerMessage);
  }
  return value;
}
