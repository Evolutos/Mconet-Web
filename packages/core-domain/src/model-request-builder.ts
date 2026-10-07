// Copyright © 2026 Mcont.

import type { Extensions } from "./extensions.js";
import type { JsonValue } from "./json-value.js";
import { isModelRequest, type ModelRequest } from "./model-request.js";
import type { ModelTarget } from "./model-target.js";
import type { ModelTaskRequest } from "./model-task-request.js";
import type { ServiceAccess } from "./service-access.js";

/** Shared immutable empty metadata until a caller supplies an explicit map. */
const emptyMetadata: Readonly<Record<string, JsonValue>> = Object.freeze({});

/** Shared immutable empty extensions until a caller supplies an explicit map. */
const emptyExtensions: Extensions = Object.freeze({});

/**
 * Incrementally constructs validated task-neutral model request envelopes.
 *
 * Target and task remain separate caller-owned values. Optional request-level
 * service access is never synthesized from either value, while metadata and
 * extensions retain direct-construction identity. Every build delegates complete
 * target, task, access, and JSON semantics to isModelRequest.
 */
export class ModelRequestBuilder {
  /** Required caller-owned routing target retained by identity. */
  readonly #target: ModelTarget;

  /** Required caller-owned open task request retained by identity. */
  readonly #task: ModelTaskRequest;

  /** Optional request-level unresolved access contribution. */
  #serviceAccess: ServiceAccess | undefined;

  /** Current descriptive request metadata for subsequent builds. */
  #metadata: Readonly<Record<string, JsonValue>> = emptyMetadata;

  /** Current forward-compatible request extensions for subsequent builds. */
  #extensions: Extensions = emptyExtensions;

  /** Creates a Builder around the two required envelope values. */
  public constructor(target: ModelTarget, task: ModelTaskRequest) {
    // Required values stay separate and unmodified; complete validation waits
    // until the optional envelope fields have also been selected at build time.
    this.#target = target;
    this.#task = task;
  }

  /** Replaces or clears request-level unresolved service access. */
  public withServiceAccess(serviceAccess: ServiceAccess | undefined): this {
    // Undefined means true absence on the next output rather than a stored
    // undefined property. Present access remains opaque until build validation.
    this.#serviceAccess = serviceAccess;
    return this;
  }

  /** Replaces descriptive model-request metadata for subsequent builds. */
  public withMetadata(metadata: Readonly<Record<string, JsonValue>>): this {
    // Retain the exact direct-construction reference without merging target,
    // task, access, or descriptor metadata into this envelope channel.
    this.#metadata = metadata;
    return this;
  }

  /** Replaces forward-compatible model-request extensions for later builds. */
  public withExtensions(extensions: Extensions): this {
    // Extension values remain data only and cannot configure Runtime components,
    // interaction options, protocol payloads, or transport behavior here.
    this.#extensions = extensions;
    return this;
  }

  /** Builds one fresh validated immutable ModelRequest envelope. */
  public build(): ModelRequest {
    // Conditional spread preserves exact optional-property semantics: clearing
    // service access removes the property instead of publishing undefined.
    const request = {
      target: this.#target,
      task: this.#task,
      ...(this.#serviceAccess === undefined ? {} : { serviceAccess: this.#serviceAccess }),
      metadata: this.#metadata,
      extensions: this.#extensions,
    };

    // Reuse the composed validator as the sole authority; the Builder neither
    // infers a protocol nor repairs target, task, access, or portable JSON data.
    if (!isModelRequest(request)) {
      throw new TypeError("ModelRequestBuilder cannot build an invalid model request.");
    }

    // Freeze only the Builder-owned envelope so every caller-owned nested value
    // keeps its exact identity and pre-existing mutability characteristics.
    return Object.freeze(request);
  }
}
