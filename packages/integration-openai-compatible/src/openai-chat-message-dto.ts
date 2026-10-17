// Copyright © 2026 Mcont.

import type { Extensions, JsonValue } from "@evolutos/mconet-core-domain";

import {
  childPath,
  invalidProtocolResponse,
  optionalString,
  requireObject,
  requireString,
  snapshotExtensions,
  unknownMembers,
} from "./wire.js";

/** Wire member that carries the role spelling. */
const messageRoleMember = "role";

/** Wire member that carries the message text. */
const messageContentMember = "content";

/** Wire member that carries a tool result's call id. */
const toolCallIdMember = "tool_call_id";

/** Wire member that carries assistant function calls. */
const toolCallsMember = "tool_calls";

/** Wire member that selects the function-tool call shape. */
const toolCallTypeMember = "type";

/** Wire member that carries the function name and raw arguments. */
const functionMember = "function";

/** Wire member that carries the function name. */
const functionNameMember = "name";

/** Wire member that carries the raw argument JSON. */
const functionArgumentsMember = "arguments";

/** Only function tools are written and read by this protocol. */
const functionToolType = "function";

/** Members that belong to the frozen message shape and are not extensions. */
const knownMessageMembers: ReadonlySet<string> = new Set([
  messageRoleMember,
  messageContentMember,
  toolCallIdMember,
  toolCallsMember,
]);

/** Name used when extension failures identify this wire value. */
const messageOwner = "OpenAIChatMessageDTO";

/** Expectation used when message text is neither a string nor an absent tool-call body. */
const contentExpectation = "must be a string";

/** Expectation used when a tool call is not the function shape. */
const functionToolExpectation = "must be a function tool call";

/**
 * One function call carried on an assistant message.
 *
 * `arguments` is the raw JSON text. This carrier does not parse it.
 */
export interface OpenAIChatFunctionCall {
  /** Call identity shared with the later tool result. */
  readonly id: string;

  /** Function name selected by the model. */
  readonly name: string;

  /** Raw JSON argument text. */
  readonly arguments: string;
}

/** Optional tool members supplied beside the frozen role and content. */
interface OpenAIChatMessageToolFields {
  /** Call id for a tool-result message. */
  readonly toolCallId?: string;

  /** Function calls for an assistant message. */
  readonly toolCalls?: readonly OpenAIChatFunctionCall[];
}

/**
 * Holds one chat message exactly as it travels.
 *
 * `role` keeps the wire spelling and `content` keeps the text without trimming
 * or normalization. A tool result also carries `toolCallId`. An assistant turn
 * may carry `toolCalls`. `extensions` holds members a response carried beyond
 * that shape. Extensions are captured for observation only and are never written
 * back, because the request profile forbids unknown members.
 */
export class OpenAIChatMessageDTO {
  /** Wire role spelling such as `system`, `user`, `assistant`, or `tool`. */
  public readonly role: string;

  /** Message text exactly as sent or received. An omitted tool-call body is stored as empty. */
  public readonly content: string;

  /** Call id when this message is a tool result. */
  public readonly toolCallId?: string;

  /** Function calls when this message is an assistant tool request. */
  public readonly toolCalls?: readonly OpenAIChatFunctionCall[];

  /** Read-only response members outside the frozen message shape. */
  public readonly extensions: Extensions;

  /**
   * Creates one message from already separated role, text, extensions, and tool facts.
   *
   * Role support is decided by the role mapping, not by this carrier. Content is
   * a string, including the empty string used when a tool call has no text.
   *
   * @param role Wire role spelling.
   * @param content Message text.
   * @param extensions Response members outside the frozen shape.
   * @param toolFields Optional call id or function calls. An omitted field stays absent.
   */
  public constructor(
    role: string,
    content: string,
    extensions: Extensions = {},
    toolFields: OpenAIChatMessageToolFields = {},
  ) {
    if (typeof role !== "string") {
      throw new TypeError(`${messageOwner} role must be a string.`);
    }
    if (typeof content !== "string") {
      throw new TypeError(`${messageOwner} content must be a string.`);
    }
    if (!isPlainToolFields(toolFields)) {
      throw new TypeError(`${messageOwner} tool fields must be an object.`);
    }

    this.role = role;
    this.content = content;
    // Copy tool facts before freezing. An omitted id or call list stays off
    // the instance so JSON later omits that member.
    const toolCallId = copyToolCallId(toolFields.toolCallId);
    const toolCalls = copyToolCalls(toolFields.toolCalls);
    if (toolCallId !== undefined) {
      this.toolCallId = toolCallId;
    }
    if (toolCalls !== undefined) {
      this.toolCalls = toolCalls;
    }
    this.extensions = snapshotExtensions(extensions, messageOwner);
    Object.freeze(this);
  }

  /**
   * Returns the request message members in frozen profile order.
   *
   * Extensions are omitted. An assistant tool call with no text is written as
   * `content: null`, which is the chat-completions shape for that turn. A tool
   * result writes `tool_call_id` beside its text.
   *
   * @returns A fresh JSON object.
   */
  public toJson(): { readonly [key: string]: JsonValue } {
    const body: { [key: string]: JsonValue } = {
      role: this.role,
      // Chat completions uses null, not "", when an assistant turn exists only
      // to request function calls.
      content: this.toolCalls !== undefined && this.content.length === 0 ? null : this.content,
    };
    if (this.toolCallId !== undefined) {
      body[toolCallIdMember] = this.toolCallId;
    }
    if (this.toolCalls !== undefined) {
      // Each call is written as a function tool. Argument text stays raw.
      body[toolCallsMember] = this.toolCalls.map((call) => ({
        id: call.id,
        type: functionToolType,
        function: {
          name: call.name,
          arguments: call.arguments,
        },
      }));
    }
    return body;
  }

  /**
   * Reads one decoded message object.
   *
   * @param value Decoded JSON for the message.
   * @param path JSON Pointer of the message, used only in failure messages.
   * @returns The message with any unknown members captured as extensions.
   */
  public static fromJson(value: unknown, path = ""): OpenAIChatMessageDTO {
    const document = requireObject(value, path);
    const role = requireString(document, messageRoleMember, path);
    // Calls are read before content so a null body is accepted only when this
    // message already carries function calls.
    const toolCalls = readToolCalls(document, path);
    const toolCallId = optionalString(document, toolCallIdMember, path);
    const content = readContent(document, path, toolCalls !== undefined);
    return new OpenAIChatMessageDTO(
      role,
      content,
      unknownMembers(document, knownMessageMembers, messageOwner),
      {
        ...(toolCallId === undefined ? {} : { toolCallId }),
        ...(toolCalls === undefined ? {} : { toolCalls }),
      },
    );
  }
}

/**
 * Returns message text.
 *
 * A string is kept exactly. Null or a missing member is accepted only when the
 * message already carries function calls, and is stored as an empty string.
 *
 * @param document Decoded message object.
 * @param path JSON Pointer of the message.
 * @param toolCallsPresent Whether function calls were present on this message.
 * @returns The message text.
 */
function readContent(
  document: Readonly<Record<string, unknown>>,
  path: string,
  toolCallsPresent: boolean,
): string {
  // A tool-call message may omit content. Any other message must carry text.
  if (!Object.hasOwn(document, messageContentMember)) {
    if (toolCallsPresent) {
      return "";
    }
    throw invalidProtocolResponse(childPath(path, messageContentMember), contentExpectation);
  }
  const descriptor = Object.getOwnPropertyDescriptor(document, messageContentMember);
  const value = descriptor !== undefined && "value" in descriptor ? descriptor.value : undefined;
  if (typeof value === "string") {
    return value;
  }
  // Null is the wire spelling of an empty tool-call body, stored here as "".
  if (value === null && toolCallsPresent) {
    return "";
  }
  throw invalidProtocolResponse(childPath(path, messageContentMember), contentExpectation);
}

/**
 * Reads function calls, or returns undefined when the member is absent.
 *
 * @param document Decoded message object.
 * @param path JSON Pointer of the message.
 * @returns Frozen calls, or undefined when the message has none.
 */
function readToolCalls(
  document: Readonly<Record<string, unknown>>,
  path: string,
): readonly OpenAIChatFunctionCall[] | undefined {
  // Absence means this message requested no functions.
  if (!Object.hasOwn(document, toolCallsMember)) {
    return undefined;
  }
  const descriptor = Object.getOwnPropertyDescriptor(document, toolCallsMember);
  const value = descriptor !== undefined && "value" in descriptor ? descriptor.value : undefined;
  // An empty list is not omission, and a non-array cannot name the calls.
  if (!Array.isArray(value) || value.length === 0) {
    throw invalidProtocolResponse(childPath(path, toolCallsMember), functionToolExpectation);
  }
  const calls: OpenAIChatFunctionCall[] = [];
  const ids = new Set<string>();
  for (let index = 0; index < value.length; index += 1) {
    const call = readFunctionCall(
      value[index],
      childPath(childPath(path, toolCallsMember), String(index)),
    );
    // One id can be answered by only one tool result.
    if (ids.has(call.id)) {
      throw invalidProtocolResponse(
        childPath(childPath(path, toolCallsMember), String(index)),
        "must not repeat a call id",
      );
    }
    ids.add(call.id);
    calls.push(call);
  }
  return Object.freeze(calls);
}

/**
 * Reads one function tool call.
 *
 * @param value Decoded call.
 * @param path JSON Pointer of the call.
 * @returns The id, name, and raw arguments.
 */
function readFunctionCall(value: unknown, path: string): OpenAIChatFunctionCall {
  const call = requireObject(value, path);
  const id = requireString(call, "id", path);
  // An empty id cannot be repeated by a later tool result.
  if (id.length === 0) {
    throw invalidProtocolResponse(childPath(path, "id"), "must be a non-empty string");
  }
  const type = requireString(call, toolCallTypeMember, path);
  // This protocol writes and reads function tools only.
  if (type !== functionToolType) {
    throw invalidProtocolResponse(childPath(path, toolCallTypeMember), functionToolExpectation);
  }
  const functionValue = requireObject(
    Object.hasOwn(call, functionMember) ? call[functionMember] : undefined,
    childPath(path, functionMember),
  );
  const name = requireString(functionValue, functionNameMember, childPath(path, functionMember));
  if (name.length === 0) {
    throw invalidProtocolResponse(
      childPath(childPath(path, functionMember), functionNameMember),
      "must be a non-empty string",
    );
  }
  // Arguments stay raw JSON text, including the empty string a stream may start with.
  return {
    id,
    name,
    arguments: requireString(
      functionValue,
      functionArgumentsMember,
      childPath(path, functionMember),
    ),
  };
}

/** Returns whether the tool-field bag is a plain object. */
function isPlainToolFields(value: unknown): value is OpenAIChatMessageToolFields {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  // The constructor's default `{}` and a null-prototype bag are both plain.
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/** Copies one call id, or returns undefined when it is omitted. */
function copyToolCallId(value: string | undefined): string | undefined {
  // Omission leaves the member off the message.
  if (value === undefined) {
    return undefined;
  }
  // An empty id cannot be matched to a later tool result.
  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError(`${messageOwner} toolCallId must be a non-empty string.`);
  }
  return value;
}

/** Copies function calls, or returns undefined when they are omitted. */
function copyToolCalls(
  value: readonly OpenAIChatFunctionCall[] | undefined,
): readonly OpenAIChatFunctionCall[] | undefined {
  if (value === undefined) {
    return undefined;
  }
  // An empty list is not a request for tools; the caller omits the member.
  if (!Array.isArray(value) || value.length === 0) {
    throw new TypeError(`${messageOwner} toolCalls must be a non-empty array or undefined.`);
  }
  const copy: OpenAIChatFunctionCall[] = [];
  const ids = new Set<string>();
  for (const call of value) {
    if (
      typeof call !== "object" ||
      call === null ||
      typeof call.id !== "string" ||
      call.id.length === 0 ||
      typeof call.name !== "string" ||
      call.name.length === 0 ||
      typeof call.arguments !== "string"
    ) {
      throw new TypeError(`${messageOwner} toolCalls must contain id, name, and arguments.`);
    }
    // Duplicate ids would make two tool results indistinguishable.
    if (ids.has(call.id)) {
      throw new TypeError(`${messageOwner} toolCalls must not repeat a call id.`);
    }
    ids.add(call.id);
    copy.push({ id: call.id, name: call.name, arguments: call.arguments });
  }
  return Object.freeze(copy);
}
