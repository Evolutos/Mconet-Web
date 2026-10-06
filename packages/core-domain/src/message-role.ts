// Copyright © 2026 Mcont.

import type { Extensions } from "./extensions.js";
import type { OpenIdentifier } from "./open-identifier.js";

/**
 * Immutable, open identity describing one message participant role.
 *
 * Standard role identifiers use the `message.*` namespace, while integrations
 * may provide any other {@link OpenIdentifier}. Optional semantic and raw values
 * preserve normalized meaning and source-protocol spelling independently. This
 * representation carries no authorization, message content, model parameters,
 * routing behavior, or role-validation logic.
 */
export interface MessageRole {
  /** Standard or integration-defined open role identifier. */
  readonly id: OpenIdentifier;

  /** Optional normalized meaning retained independently from role identity. */
  readonly semantic?: string;

  /** Optional original source-protocol role value preserved without coercion. */
  readonly rawValue?: string;

  /** Always-present namespaced role extensions for forward-compatible data. */
  readonly extensions: Extensions;
}
