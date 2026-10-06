// Copyright © 2026 Mcont.

import type { Extensions } from "./extensions.js";
import type { JsonValue } from "./json-value.js";
import type { MessageContent } from "./message-content.js";
import { isMessageEntry, type MessageEntry } from "./message-entry.js";
import type { MessageRelation } from "./message-relation.js";
import type { MessageRole } from "./message-role.js";

/** Shared immutable empty metadata used until a caller supplies explicit data. */
const emptyMetadata: Readonly<Record<string, JsonValue>> = Object.freeze({});

/** Shared immutable empty extensions used until a caller supplies explicit data. */
const emptyExtensions: Extensions = Object.freeze({});

/**
 * Incrementally constructs validated immutable MessageEntry snapshots.
 *
 * The Builder owns only its ordered content and relation collections. Supplied
 * role, content, relation, metadata, and extension values retain their identity,
 * matching direct MessageEntry construction without normalization or semantic
 * coercion. Each build creates new frozen collection snapshots and validates the
 * complete local entry contract; document-wide IDs and endpoints remain the
 * responsibility of the containing MessageDocument validator.
 */
export class MessageEntryBuilder {
  /** Stable identity copied into every entry snapshot built from this instance. */
  readonly #id: string;

  /** Participant role copied by identity into every built entry. */
  readonly #role: MessageRole;

  /** Builder-owned insertion-ordered content references. */
  readonly #content: MessageContent[] = [];

  /** Builder-owned insertion-ordered relation references. */
  readonly #relations: MessageRelation[] = [];

  /** Current caller-supplied metadata reference or the immutable empty default. */
  #metadata: Readonly<Record<string, JsonValue>> = emptyMetadata;

  /** Current caller-supplied extensions reference or the immutable empty default. */
  #extensions: Extensions = emptyExtensions;

  /**
   * Creates an empty entry builder for one stable identity and role.
   *
   * Runtime validation occurs at build time so JavaScript callers receive the
   * same complete-entry decision as direct values passed to isMessageEntry.
   *
   * @param id Stable entry identity within the future MessageDocument.
   * @param role Participant role retained without normalization.
   */
  public constructor(id: string, role: MessageRole) {
    // Preserve both required scalar references exactly; no validation side
    // effects or role copies occur before the caller requests a snapshot.
    this.#id = id;
    this.#role = role;
  }

  /**
   * Appends one content value in caller-declared order.
   *
   * @param content Typed content reference to retain in later snapshots.
   * @returns This Builder for fluent composition.
   */
  public addContent(content: MessageContent): this {
    // The private array isolates collection membership from returned snapshots;
    // the content object itself retains direct-construction identity semantics.
    this.#content.push(content);
    return this;
  }

  /**
   * Appends one relation in caller-declared order without resolving endpoints.
   *
   * @param relation Directed relation reference to retain in later snapshots.
   * @returns This Builder for fluent composition.
   */
  public addRelation(relation: MessageRelation): this {
    // Endpoint existence requires the complete document, so this method records
    // insertion order only and leaves syntax validation to build().
    this.#relations.push(relation);
    return this;
  }

  /**
   * Replaces the metadata reference used by subsequent entry snapshots.
   *
   * @param metadata JSON-compatible metadata retained without copying.
   * @returns This Builder for fluent composition.
   */
  public withMetadata(metadata: Readonly<Record<string, JsonValue>>): this {
    // Assignment changes only future builds; entries already returned own their
    // top-level reference and frozen collection snapshots independently.
    this.#metadata = metadata;
    return this;
  }

  /**
   * Replaces the extension reference used by subsequent entry snapshots.
   *
   * @param extensions Namespaced JSON extension data retained without copying.
   * @returns This Builder for fluent composition.
   */
  public withExtensions(extensions: Extensions): this {
    // Keep extension values opaque to the Builder. The shared entry validator
    // later checks only their portable recursive JSON boundary.
    this.#extensions = extensions;
    return this;
  }

  /**
   * Builds one validated immutable MessageEntry snapshot.
   *
   * @returns Frozen entry with independent frozen content and relation arrays.
   * @throws {TypeError} When accumulated state violates the local entry contract.
   */
  public build(): MessageEntry {
    // Copy before validation so later Builder mutations cannot rewrite this
    // candidate's order or collection membership after it is returned.
    const entry = {
      id: this.#id,
      kind: "message.entry" as const,
      role: this.#role,
      content: Object.freeze([...this.#content]),
      relations: Object.freeze([...this.#relations]),
      metadata: this.#metadata,
      extensions: this.#extensions,
    };

    // Reuse the single local contract rather than duplicating identifier, role,
    // content, relation, and JSON rules inside the construction convenience API.
    if (!isMessageEntry(entry)) {
      throw new TypeError("MessageEntryBuilder cannot build an invalid MessageEntry.");
    }

    // Freeze only the Builder-owned envelope. Nested caller-owned readonly values
    // retain identity and are never mutated as a hidden construction side effect.
    return Object.freeze(entry);
  }
}
