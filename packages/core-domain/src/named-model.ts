// Copyright © 2026 Mcont.

import type { Extensions } from "./extensions.js";
import type { JsonValue } from "./json-value.js";
import type { ModelDescriptor } from "./model-descriptor.js";
import type { OpenIdentifier } from "./open-identifier.js";

/** Frozen empty metadata reused safely by every name-only model instance. */
const emptyMetadata: Readonly<Record<string, JsonValue>> = Object.freeze({});

/** Frozen empty extension map reused safely by every name-only model instance. */
const emptyExtensions: Extensions = Object.freeze({});

/**
 * Minimal immutable model descriptor for callers that only know a model name.
 *
 * The class preserves the supplied protocol name exactly, leaves optional
 * descriptive fields absent, and exposes frozen empty metadata and extension
 * maps. It does not parse the name, infer a family or version, or validate
 * untrusted input; those responsibilities belong to explicit boundary logic.
 */
export class NamedModel implements ModelDescriptor {
  /** Protocol-facing model name supplied by the caller. */
  public readonly name: string;

  /** Optional display label remains absent for a name-only descriptor. */
  declare public readonly displayName?: string;

  /** Optional family remains absent rather than being inferred from the name. */
  declare public readonly family?: OpenIdentifier;

  /** Optional version remains absent rather than being parsed from the name. */
  declare public readonly version?: string;

  /** Frozen empty metadata because no descriptive metadata was supplied. */
  public readonly metadata: Readonly<Record<string, JsonValue>>;

  /** Frozen empty extensions because no namespaced data was supplied. */
  public readonly extensions: Extensions;

  /**
   * Creates a name-only model descriptor without normalization or inference.
   *
   * @param name Protocol-facing model name to preserve exactly.
   */
  public constructor(name: string) {
    // Preserve the caller's spelling byte-for-byte. Runtime validation is a
    // separate trust-boundary concern and must not become implicit coercion.
    this.name = name;

    // Reuse only frozen empty maps, making shared defaults safe while keeping
    // the two semantic containers independently identifiable.
    this.metadata = emptyMetadata;
    this.extensions = emptyExtensions;

    // Freeze after every public field is initialized so JavaScript callers
    // receive the same immutable default state promised by readonly types.
    Object.freeze(this);
  }
}
