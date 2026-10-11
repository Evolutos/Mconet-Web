// Copyright © 2026 Mcont.

import type { Extensions } from "@evolutos/mconet-core-domain";

import { OpenAIChatCompletionChoiceDTO } from "./openai-chat-completion-choice-dto.js";
import { OpenAIChatCompletionUsageDTO } from "./openai-chat-completion-usage-dto.js";
import {
  childPath,
  optionalString,
  requireArray,
  requireObject,
  snapshotExtensions,
  unknownMembers,
} from "./wire.js";

/** Wire member that carries the service response identifier. */
const responseIdMember = "id";

/** Wire member that carries the reported model name. */
const responseModelMember = "model";

/** Wire member that carries the ordered choices. */
const responseChoicesMember = "choices";

/** Wire member that carries reported token usage. */
const responseUsageMember = "usage";

/** Members that belong to the frozen response shape and are not extensions. */
const knownResponseMembers: ReadonlySet<string> = new Set([
  responseIdMember,
  responseModelMember,
  responseChoicesMember,
  responseUsageMember,
]);

/** Name used when construction failures identify this wire value. */
const responseOwner = "OpenAIChatCompletionResponseDTO";

/** JSON Pointer of a response body read at the document root. */
const responseRootPath = "";

/**
 * Optional response members. Each field is omitted when the service did not send it.
 *
 * The type stays module-private so this step publishes one wire value.
 */
interface OpenAIChatCompletionResponseOptions {
  /** Service response identifier, or omitted when not sent. */
  readonly id?: string;

  /** Model name the service reports it used, or omitted when not sent. */
  readonly model?: string;

  /** Reported token usage, or omitted when not sent. */
  readonly usage?: OpenAIChatCompletionUsageDTO;

  /** Response members outside the frozen shape. */
  readonly extensions?: Extensions;
}

/**
 * Holds one decoded successful chat-completion response body.
 *
 * `choices` keeps every element in service order. How many choices a result
 * may contain is decided by the response mapping, so this value also holds an
 * empty or multi-choice body. Members outside the frozen shape, such as
 * `object`, `created`, and `system_fingerprint`, are captured in `extensions`.
 */
export class OpenAIChatCompletionResponseDTO {
  /** Decoded choices in the order the service sent them. */
  public readonly choices: readonly OpenAIChatCompletionChoiceDTO[];

  /**
   * Service response identifier when the service sent one.
   *
   * Declared so an omitted identifier is absent rather than an own undefined value.
   */
  declare public readonly id?: string;

  /**
   * Model name the service reports it used, when the service sent one.
   *
   * Declared so an omitted model is absent rather than an own undefined value.
   */
  declare public readonly model?: string;

  /**
   * Reported token usage when the service sent it.
   *
   * Declared so omitted usage is absent rather than an own undefined value.
   */
  declare public readonly usage?: OpenAIChatCompletionUsageDTO;

  /** Read-only response members outside the frozen shape. */
  public readonly extensions: Extensions;

  /**
   * Creates one response from decoded choices and any optional members.
   *
   * @param choices Choices in service order. An empty list is retained as sent.
   * @param options Optional members. An omitted field is not stored as null.
   */
  public constructor(
    choices: readonly OpenAIChatCompletionChoiceDTO[],
    options: OpenAIChatCompletionResponseOptions = {},
  ) {
    if (!isPlainOptions(options)) {
      throw new TypeError(`${responseOwner} options must be an object.`);
    }

    this.choices = copyChoices(choices);
    const id = requireOptionalString(options.id, responseIdMember);
    const model = requireOptionalString(options.model, responseModelMember);
    const usage = requireOptionalUsage(options.usage);
    if (id !== undefined) {
      this.id = id;
    }
    if (model !== undefined) {
      this.model = model;
    }
    if (usage !== undefined) {
      this.usage = usage;
    }
    this.extensions = snapshotExtensions(options.extensions ?? {}, responseOwner);
    Object.freeze(this);
  }

  /**
   * Reads one decoded successful response body.
   *
   * Members are read in frozen profile order, so the first failure is stable
   * when several members are wrong.
   *
   * @param value Decoded JSON for the complete response body.
   * @returns The response with any unknown top-level members captured.
   */
  public static fromJson(value: unknown): OpenAIChatCompletionResponseDTO {
    const document = requireObject(value, responseRootPath);
    const id = optionalString(document, responseIdMember, responseRootPath);
    const model = optionalString(document, responseModelMember, responseRootPath);
    const choicesPath = childPath(responseRootPath, responseChoicesMember);
    const choiceValues = requireArray(document, responseChoicesMember, responseRootPath);
    const choices: OpenAIChatCompletionChoiceDTO[] = [];
    for (let index = 0; index < choiceValues.length; index += 1) {
      choices.push(
        OpenAIChatCompletionChoiceDTO.fromJson(
          choiceValues[index],
          childPath(choicesPath, String(index)),
        ),
      );
    }

    const options: {
      id?: string;
      model?: string;
      usage?: OpenAIChatCompletionUsageDTO;
      extensions: Extensions;
    } = {
      extensions: unknownMembers(document, knownResponseMembers, responseOwner),
    };
    if (id !== undefined) {
      options.id = id;
    }
    if (model !== undefined) {
      options.model = model;
    }
    // A present usage member is read even when null, so a null fails as an object
    // rather than being treated as omission.
    if (Object.hasOwn(document, responseUsageMember)) {
      options.usage = OpenAIChatCompletionUsageDTO.fromJson(
        document[responseUsageMember],
        childPath(responseRootPath, responseUsageMember),
      );
    }
    return new OpenAIChatCompletionResponseDTO(choices, options);
  }
}

/**
 * Returns whether the options bag is a plain object the constructor can read.
 *
 * @param value Candidate options value.
 * @returns Whether the value is an ordinary object.
 */
function isPlainOptions(value: unknown): value is object {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/**
 * Copies a choice list, including an empty list, in the caller's order.
 *
 * @param value Candidate choice list.
 * @returns A frozen list in service order.
 */
function copyChoices(
  value: readonly OpenAIChatCompletionChoiceDTO[],
): readonly OpenAIChatCompletionChoiceDTO[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) {
    throw new TypeError(`${responseOwner} choices must be an array.`);
  }

  const copy: OpenAIChatCompletionChoiceDTO[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const choice = value[index];
    if (!(choice instanceof OpenAIChatCompletionChoiceDTO)) {
      throw new TypeError(
        `${responseOwner} choices must contain OpenAIChatCompletionChoiceDTO values.`,
      );
    }
    copy.push(choice);
  }
  return Object.freeze(copy);
}

/**
 * Returns one optional string, or undefined when the member is omitted.
 *
 * @param value Candidate string.
 * @param name Public field name used in the failure.
 * @returns The string, or undefined.
 */
function requireOptionalString(value: unknown, name: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new TypeError(`${responseOwner} ${name} must be a string or undefined.`);
  }
  return value;
}

/**
 * Returns optional usage, or undefined when the member is omitted.
 *
 * @param value Candidate usage value.
 * @returns The usage value, or undefined.
 */
function requireOptionalUsage(value: unknown): OpenAIChatCompletionUsageDTO | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!(value instanceof OpenAIChatCompletionUsageDTO)) {
    throw new TypeError(
      `${responseOwner} usage must be an OpenAIChatCompletionUsageDTO or undefined.`,
    );
  }
  return value;
}
