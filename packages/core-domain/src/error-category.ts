// Copyright © 2026 Mcont.

import type { OpenIdentifier } from "./open-identifier.js";

/**
 * Stable high-level classification for a model interaction failure.
 *
 * The listed literals form the SDK's standard vocabulary. The final open
 * identifier arm preserves unknown categories introduced by integrations or
 * future SDK versions while retaining editor completion for standard values.
 * Untrusted runtime values still require open-identifier validation at their
 * trust boundary; this type only defines the public representation.
 */
export type ErrorCategory =
  | "invalid_request"
  | "invalid_component_configuration"
  | "unsupported_feature"
  | "authentication"
  | "permission"
  | "rate_limit"
  | "content_filter"
  | "context_length"
  | "timeout"
  | "cancelled"
  | "network"
  | "serialization"
  | "deserialization"
  | "protocol"
  | "model_service"
  | "unknown"
  | (OpenIdentifier & Record<never, never>);
