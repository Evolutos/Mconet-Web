// Copyright © 2026 Mcont.

import type { Extensions } from "./extensions.js";
import type { JsonValue } from "./json-value.js";
import { isMessageDocument, type MessageDocument } from "./message-document.js";
import type { MessageGroup } from "./message-group.js";

/** Shared immutable empty metadata used until a caller supplies explicit data. */
const emptyMetadata: Readonly<Record<string, JsonValue>> = Object.freeze({});

/** Shared immutable empty extensions used until a caller supplies explicit data. */
const emptyExtensions: Extensions = Object.freeze({});

/**
 * Constructs validated immutable MessageDocument envelope snapshots.
 *
 * Version, purpose, and root are retained exactly as supplied. The Builder owns
 * only the outer envelope it creates; the caller-owned MessageGroup tree and JSON
 * maps retain their identities and are never copied, traversed, or frozen except
 * by the shared document validator during build. No task, access, model, protocol,
 * authorization, or execution state can be introduced through this API.
 */
export class MessageDocumentBuilder {
  /** Opaque version copied into every document built from this instance. */
  readonly #version: string;

  /** Standard or integration-defined purpose retained without normalization. */
  readonly #purpose: MessageDocument["purpose"];

  /** Caller-owned root tree retained by identity. */
  readonly #root: MessageGroup;

  /** Current caller-supplied document metadata or immutable empty default. */
  #metadata: Readonly<Record<string, JsonValue>> = emptyMetadata;

  /** Current caller-supplied document extensions or immutable empty default. */
  #extensions: Extensions = emptyExtensions;

  /**
   * Creates a Builder for one versioned Message-domain root.
   *
   * Runtime validation occurs at build time so all envelope and whole-tree rules
   * use the same decision as direct values passed to isMessageDocument.
   *
   * @param version Opaque nonblank message schema version.
   * @param purpose Standard or integration-defined document purpose.
   * @param root MessageGroup expected to use the exact message.root kind.
   */
  public constructor(version: string, purpose: MessageDocument["purpose"], root: MessageGroup) {
    // Preserve each required envelope value exactly. Deferring validation lets
    // build evaluate the complete tree once without duplicating its invariants.
    this.#version = version;
    this.#purpose = purpose;
    this.#root = root;
  }

  /**
   * Replaces the metadata reference used by subsequent document snapshots.
   *
   * @param metadata JSON-compatible metadata retained without copying.
   * @returns This Builder for fluent composition.
   */
  public withMetadata(metadata: Readonly<Record<string, JsonValue>>): this {
    // Assignment affects only future builds; an already returned document keeps
    // the exact metadata reference selected when its envelope was created.
    this.#metadata = metadata;
    return this;
  }

  /**
   * Replaces the extension reference used by subsequent document snapshots.
   *
   * @param extensions Namespaced JSON extension data retained without copying.
   * @returns This Builder for fluent composition.
   */
  public withExtensions(extensions: Extensions): this {
    // Extension data stays opaque to construction. The shared validator checks
    // its recursive JSON boundary without promoting values into behavior.
    this.#extensions = extensions;
    return this;
  }

  /**
   * Builds one validated immutable MessageDocument envelope.
   *
   * @returns Frozen envelope retaining the caller-owned root and JSON map identities.
   * @throws {TypeError} When the envelope or complete message tree is invalid.
   */
  public build(): MessageDocument {
    // Allocate a fresh outer object on every call so later Builder configuration
    // changes cannot replace fields on a previously returned document.
    const document = {
      version: this.#version,
      purpose: this.#purpose,
      root: this.#root,
      metadata: this.#metadata,
      extensions: this.#extensions,
    };

    // Delegate root kind, nested validators, shared IDs, cycle detection, and
    // relation endpoint resolution to the single complete document contract.
    if (!isMessageDocument(document)) {
      throw new TypeError("MessageDocumentBuilder cannot build an invalid MessageDocument.");
    }

    // Freeze only the Builder-owned envelope; caller-owned nested values retain
    // direct-construction identity and are not mutated as a hidden side effect.
    return Object.freeze(document);
  }
}
