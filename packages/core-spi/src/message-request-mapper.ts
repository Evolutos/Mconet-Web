// Copyright © 2026 Mcont.

import type { MessageDocument } from "@evolutos/mconet-core-domain";

import type { ErasedRuntimeValue } from "./erased-runtime-value.js";
import type { RuntimeComponent } from "./runtime-component.js";

/**
 * Replaceable message-subdomain mapping from a document to a request fragment.
 *
 * Implementations preserve message order, roles, relations, and content while
 * producing one unencoded protocol-native value. The owning task adapter composes
 * that fragment with task-level fields; byte encoding, authorization, transport,
 * task configuration, and component selection remain outside this mapper.
 */
export interface MessageRequestMapper extends RuntimeComponent {
  /** Maps one validated message document to an unencoded protocol fragment. */
  mapRequest(document: MessageDocument): ErasedRuntimeValue;
}
