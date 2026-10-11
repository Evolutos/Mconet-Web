// Copyright © 2026 Mcont.

import type { Extensions } from "@evolutos/mconet-core-domain";

import { OpenAIChatMessageDTO } from "./openai-chat-message-dto.js";
import {
  childPath,
  requireCount,
  requireObject,
  requireString,
  snapshotExtensions,
  unknownMembers,
} from "./wire.js";

/** Wire member that carries the choice position. */
const choiceIndexMember = "index";

/** Wire member that carries the generated message. */
const choiceMessageMember = "message";

/** Wire member that carries the service finish reason. */
const choiceFinishReasonMember = "finish_reason";

/** Members that belong to the frozen choice shape and are not extensions. */
const knownChoiceMembers: ReadonlySet<string> = new Set([
  choiceIndexMember,
  choiceMessageMember,
  choiceFinishReasonMember,
]);

/** Name used when construction failures identify this wire value. */
const choiceOwner = "OpenAIChatCompletionChoiceDTO";

/** Failure used when an integer is outside the binary64 safe range. */
const jsonSafeIntegerMessage = "JSON integer must be within the interoperable safe range.";

/** Failure used when a number would lose its sign in JSON. */
const jsonNegativeZeroMessage = "JSON number must not be negative zero.";

/**
 * Holds one decoded `choices` element of a successful response.
 *
 * `finishReason` keeps the service text exactly. Interpreting it as a status
 * belongs to the response mapping, so unknown reasons stay unchanged. Members
 * outside the frozen shape, such as `logprobs`, are captured in `extensions`
 * and are not interpreted.
 */
export class OpenAIChatCompletionChoiceDTO {
  /** Position the service assigned to this choice. */
  public readonly index: number;

  /** Generated message carried by this choice. */
  public readonly message: OpenAIChatMessageDTO;

  /** Service-reported reason the generation ended, kept without reinterpretation. */
  public readonly finishReason: string;

  /** Read-only choice members outside the frozen shape. */
  public readonly extensions: Extensions;

  /**
   * Creates one choice from already separated index, message, and reason.
   *
   * @param index Non-negative choice position.
   * @param message Generated message.
   * @param finishReason Service-reported finish reason.
   * @param extensions Response members outside the frozen shape.
   */
  public constructor(
    index: number,
    message: OpenAIChatMessageDTO,
    finishReason: string,
    extensions: Extensions = {},
  ) {
    if (typeof index !== "number" || !Number.isInteger(index)) {
      throw new TypeError(`${choiceOwner} index must be an integer.`);
    }
    if (Object.is(index, -0)) {
      throw new RangeError(jsonNegativeZeroMessage);
    }
    if (!Number.isSafeInteger(index)) {
      throw new RangeError(jsonSafeIntegerMessage);
    }
    if (index < 0) {
      throw new RangeError(`${choiceOwner} index must not be negative.`);
    }
    if (!(message instanceof OpenAIChatMessageDTO)) {
      throw new TypeError(`${choiceOwner} message must be an OpenAIChatMessageDTO.`);
    }
    if (typeof finishReason !== "string") {
      throw new TypeError(`${choiceOwner} finishReason must be a string.`);
    }

    this.index = index;
    this.message = message;
    this.finishReason = finishReason;
    this.extensions = snapshotExtensions(extensions, choiceOwner);
    Object.freeze(this);
  }

  /**
   * Reads one decoded choice object.
   *
   * @param value Decoded JSON for the choice.
   * @param path JSON Pointer of the choice, used only in failure messages.
   * @returns The choice with any unknown members captured as extensions.
   */
  public static fromJson(value: unknown, path = ""): OpenAIChatCompletionChoiceDTO {
    const document = requireObject(value, path);
    const index = requireCount(document, choiceIndexMember, path);
    // A missing message is read as an absent value so the nested failure names
    // the message pointer rather than the choice object.
    const message = OpenAIChatMessageDTO.fromJson(
      Object.hasOwn(document, choiceMessageMember) ? document[choiceMessageMember] : undefined,
      childPath(path, choiceMessageMember),
    );
    const finishReason = requireString(document, choiceFinishReasonMember, path);
    return new OpenAIChatCompletionChoiceDTO(
      index,
      message,
      finishReason,
      unknownMembers(document, knownChoiceMembers, choiceOwner),
    );
  }
}
