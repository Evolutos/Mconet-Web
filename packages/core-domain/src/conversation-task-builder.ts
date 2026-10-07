// Copyright © 2026 Mcont.

import type { ArtifactCatalog } from "./artifact-catalog.js";
import {
  isConversationTaskRequest,
  type ConversationTaskRequest,
} from "./conversation-task-request.js";
import type { Extensions } from "./extensions.js";
import type { JsonValue } from "./json-value.js";
import type { TaskDocument } from "./task-document.js";

/** Shared immutable descriptor for the fixed conversation-generation task. */
const conversationDescriptor = Object.freeze({
  type: "conversation.generate" as const,
  metadata: Object.freeze({}),
  extensions: Object.freeze({}),
});

/** Shared immutable empty metadata until a caller supplies an explicit map. */
const emptyMetadata: Readonly<Record<string, JsonValue>> = Object.freeze({});

/** Shared immutable empty extensions until a caller supplies an explicit map. */
const emptyExtensions: Extensions = Object.freeze({});

/**
 * Incrementally constructs validated immutable conversation task requests.
 *
 * The required TaskDocument remains caller-owned and retains its complete Task
 * and Message trees. Artifact scope, request metadata, and request extensions map
 * directly to the remaining request fields. Every build delegates complete
 * structural and supported-range semantics to isConversationTaskRequest rather
 * than duplicating validator rules in this convenience API.
 *
 * This mutable Builder is intentionally not concurrency-safe. Requests already
 * returned are independent frozen envelopes and can be shared normally.
 */
export class ConversationTaskBuilder {
  /** Complete caller-owned Task tree retained by identity for every build. */
  readonly #document: TaskDocument;

  /** Current request-local Artifact scope used by subsequent builds. */
  #artifacts: ArtifactCatalog;

  /** Current caller-owned request metadata used by subsequent builds. */
  #metadata: Readonly<Record<string, JsonValue>> = emptyMetadata;

  /** Current caller-owned request extensions used by subsequent builds. */
  #extensions: Extensions = emptyExtensions;

  /**
   * Creates a Builder around one complete conversation TaskDocument.
   *
   * Validation is deferred until build so direct construction and Builder output
   * use the same whole-request decision exactly once.
   *
   * @param document Versioned Task tree retained without copying or traversal.
   */
  public constructor(document: TaskDocument) {
    // Preserve the required domain reference exactly. A fresh frozen empty
    // Catalog gives each Builder an independent request-local default scope.
    this.#document = document;
    this.#artifacts = Object.freeze({ artifacts: Object.freeze([]) });
  }

  /**
   * Replaces the Artifact scope used by subsequent request snapshots.
   *
   * @param artifacts Request-local Catalog retained without copying or reading.
   * @returns This Builder for fluent construction.
   */
  public withArtifacts(artifacts: ArtifactCatalog): this {
    // Replacement affects only future builds. Scope support and Artifact
    // semantics remain owned by the complete request validator at build time.
    this.#artifacts = artifacts;
    return this;
  }

  /**
   * Replaces descriptive request metadata used by subsequent snapshots.
   *
   * @param metadata Portable JSON map retained by identity.
   * @returns This Builder for fluent construction.
   */
  public withMetadata(metadata: Readonly<Record<string, JsonValue>>): this {
    // Retain direct-construction identity and keep metadata separate from Task
    // document metadata, descriptor metadata, and extension data.
    this.#metadata = metadata;
    return this;
  }

  /**
   * Replaces forward-compatible request extensions used by later snapshots.
   *
   * @param extensions Namespaced portable JSON map retained by identity.
   * @returns This Builder for fluent construction.
   */
  public withExtensions(extensions: Extensions): this {
    // Values stay opaque until the shared validator checks their portable JSON
    // boundary; no extension becomes Task input or executable behavior here.
    this.#extensions = extensions;
    return this;
  }

  /**
   * Builds one validated immutable conversation task request snapshot.
   *
   * @returns Fresh frozen request retaining every selected nested value by identity.
   * @throws {TypeError} When accumulated state is not a supported conversation request.
   */
  public build(): ConversationTaskRequest {
    // Allocate a new envelope on every call so later fluent replacements cannot
    // alter the field references observed by an already returned request.
    const request = {
      descriptor: conversationDescriptor,
      document: this.#document,
      artifacts: this.#artifacts,
      metadata: this.#metadata,
      extensions: this.#extensions,
    };

    // This predicate remains the single authority for Task, Message, generation,
    // Artifact-scope, and recursive JSON semantics. The Builder adds no defaults
    // inside caller-owned documents and never repairs an invalid request.
    if (!isConversationTaskRequest(request)) {
      throw new TypeError(
        "ConversationTaskBuilder cannot build an invalid conversation task request.",
      );
    }

    // Freeze only the newly owned envelope. The fixed descriptor and default
    // Catalog are already frozen; caller-owned nested values remain untouched.
    return Object.freeze(request);
  }
}
