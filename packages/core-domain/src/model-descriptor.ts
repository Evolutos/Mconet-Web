// Copyright © 2026 Mcont.

import type { Extensions } from "./extensions.js";
import type { JsonValue } from "./json-value.js";
import type { OpenIdentifier } from "./open-identifier.js";

/**
 * Open description of a model addressable by an interaction protocol.
 *
 * `name` is the only required descriptive identity and is the value a protocol
 * adapter writes into its model-selection field. Optional labels, family, and
 * version provide matching or presentation context without becoming protocol
 * parameters. Metadata and extensions are always-present readonly JSON maps so
 * callers can use empty objects instead of introducing absence semantics.
 *
 * The interface is intentionally structural: applications and integrations may
 * implement it with additional domain fields. Untrusted values require runtime
 * validation at trust boundaries; this type alone performs no validation.
 */
export interface ModelDescriptor {
  /** Protocol-facing model name and sole required descriptive identity. */
  readonly name: string;

  /** Optional human-readable label that does not replace the protocol name. */
  readonly displayName?: string;

  /** Optional open family identifier used for matching related models. */
  readonly family?: OpenIdentifier;

  /** Optional provider-defined model version retained without interpretation. */
  readonly version?: string;

  /** Always-present, platform-neutral descriptive metadata. */
  readonly metadata: Readonly<Record<string, JsonValue>>;

  /** Always-present namespaced extension data for forward-compatible contracts. */
  readonly extensions: Extensions;
}
