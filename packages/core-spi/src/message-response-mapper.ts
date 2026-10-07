// Copyright © 2026 Mcont.

import type { ErasedRuntimeValue } from "./erased-runtime-value.js";
import type { MessageMappingResult } from "./message-mapping-result.js";
import type { RuntimeComponent } from "./runtime-component.js";

/**
 * Replaceable message-subdomain mapping from a decoded response fragment.
 *
 * Implementations recover message order, roles, relations, content, and local
 * Artifact references from one protocol-native value. The document and its
 * result-local Artifact Catalog cross this boundary atomically; byte decoding,
 * task-result assembly, catalog merging, transport, and authorization stay out.
 */
export interface MessageResponseMapper extends RuntimeComponent {
  /** Maps one decoded protocol fragment to its complete message-domain result. */
  mapResponse(fragment: ErasedRuntimeValue): MessageMappingResult;
}
