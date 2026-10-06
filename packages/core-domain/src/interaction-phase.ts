// Copyright © 2026 Mcont.

import type { OpenIdentifier } from "./open-identifier.js";

/**
 * Pipeline stage in which an interaction diagnostic or failure originated.
 *
 * The listed literals describe the SDK's standard non-streaming pipeline. The
 * open identifier arm preserves phases added by integrations or future SDK
 * versions while retaining editor completion for standard values. Untrusted
 * runtime values still require validation at their trust boundary.
 */
export type InteractionPhase =
  | "validation"
  | "resolution"
  | "planning"
  | "encoding"
  | "authorization"
  | "transport"
  | "decoding"
  | "response_parsing"
  | (OpenIdentifier & Record<never, never>);
