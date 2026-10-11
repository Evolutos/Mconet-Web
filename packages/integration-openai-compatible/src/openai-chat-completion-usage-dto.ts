// Copyright © 2026 Mcont.

import type { Extensions } from "@evolutos/mconet-core-domain";

import { optionalCount, requireObject, snapshotExtensions, unknownMembers } from "./wire.js";

/** Wire member that carries the input token count. */
const promptTokensMember = "prompt_tokens";

/** Wire member that carries the output token count. */
const completionTokensMember = "completion_tokens";

/** Wire member that carries the reported total token count. */
const totalTokensMember = "total_tokens";

/** Members that belong to the frozen usage shape and are not extensions. */
const knownUsageMembers: ReadonlySet<string> = new Set([
  promptTokensMember,
  completionTokensMember,
  totalTokensMember,
]);

/** Name used when construction failures identify this wire value. */
const usageOwner = "OpenAIChatCompletionUsageDTO";

/** Failure used when an integer is outside the binary64 safe range. */
const jsonSafeIntegerMessage = "JSON integer must be within the interoperable safe range.";

/** Failure used when a number would lose its sign in JSON. */
const jsonNegativeZeroMessage = "JSON number must not be negative zero.";

/**
 * Optional usage counts. Each count is omitted when the service did not send it.
 *
 * The type stays module-private so this step publishes one wire value.
 */
interface OpenAIChatCompletionUsageOptions {
  /** Input token count, or omitted when the service did not send it. */
  readonly promptTokens?: number;

  /** Output token count, or omitted when the service did not send it. */
  readonly completionTokens?: number;

  /** Reported total, or omitted when the service did not send it. */
  readonly totalTokens?: number;

  /** Response members outside the frozen usage shape. */
  readonly extensions?: Extensions;
}

/**
 * Holds the decoded `usage` object of a successful response.
 *
 * Each count is independently optional. An omitted count means the service did
 * not send the member, and zero is an explicit count. `totalTokens` is kept as
 * reported and is never computed from the other counts. Breakdown members such
 * as `prompt_tokens_details` are captured in `extensions`.
 */
export class OpenAIChatCompletionUsageDTO {
  /**
   * Input token count when the service reported one.
   *
   * Declared so an omitted count is absent rather than an own undefined value.
   */
  declare public readonly promptTokens?: number;

  /**
   * Output token count when the service reported one.
   *
   * Declared so an omitted count is absent rather than an own undefined value.
   */
  declare public readonly completionTokens?: number;

  /**
   * Reported total when the service reported one.
   *
   * Declared so an omitted count is absent rather than an own undefined value.
   */
  declare public readonly totalTokens?: number;

  /** Read-only usage members outside the frozen shape. */
  public readonly extensions: Extensions;

  /**
   * Creates usage from independently optional counts.
   *
   * @param options Counts and extension members. Omitted counts stay absent.
   */
  public constructor(options: OpenAIChatCompletionUsageOptions = {}) {
    if (!isPlainOptions(options)) {
      throw new TypeError(`${usageOwner} options must be an object.`);
    }

    const promptTokens = requireOptionalCount(options.promptTokens, "promptTokens");
    const completionTokens = requireOptionalCount(options.completionTokens, "completionTokens");
    const totalTokens = requireOptionalCount(options.totalTokens, "totalTokens");
    // Assign only supplied counts so absence stays distinct from an explicit zero.
    if (promptTokens !== undefined) {
      this.promptTokens = promptTokens;
    }
    if (completionTokens !== undefined) {
      this.completionTokens = completionTokens;
    }
    if (totalTokens !== undefined) {
      this.totalTokens = totalTokens;
    }
    this.extensions = snapshotExtensions(options.extensions ?? {}, usageOwner);
    Object.freeze(this);
  }

  /**
   * Reads one decoded usage object.
   *
   * @param value Decoded JSON for the usage object.
   * @param path JSON Pointer of the usage object, used only in failure messages.
   * @returns The usage counts with any unknown members captured as extensions.
   */
  public static fromJson(value: unknown, path = ""): OpenAIChatCompletionUsageDTO {
    const document = requireObject(value, path);
    // Copy only counts the service actually sent so an omitted member is not
    // reintroduced as an explicit undefined property.
    const options: {
      promptTokens?: number;
      completionTokens?: number;
      totalTokens?: number;
      extensions: Extensions;
    } = {
      extensions: unknownMembers(document, knownUsageMembers, usageOwner),
    };
    const promptTokens = optionalCount(document, promptTokensMember, path);
    const completionTokens = optionalCount(document, completionTokensMember, path);
    const totalTokens = optionalCount(document, totalTokensMember, path);
    if (promptTokens !== undefined) {
      options.promptTokens = promptTokens;
    }
    if (completionTokens !== undefined) {
      options.completionTokens = completionTokens;
    }
    if (totalTokens !== undefined) {
      options.totalTokens = totalTokens;
    }
    return new OpenAIChatCompletionUsageDTO(options);
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
 * Returns one optional safe count, or undefined when the member is omitted.
 *
 * @param value Candidate count.
 * @param name Public field name used in the failure.
 * @returns The portable count, or undefined.
 */
function requireOptionalCount(value: unknown, name: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new TypeError(`${usageOwner} ${name} must be an integer or undefined.`);
  }
  if (Object.is(value, -0)) {
    throw new RangeError(jsonNegativeZeroMessage);
  }
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(jsonSafeIntegerMessage);
  }
  if (value < 0) {
    throw new RangeError(`${usageOwner} ${name} must not be negative.`);
  }
  return value;
}
