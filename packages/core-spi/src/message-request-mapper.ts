// Copyright © 2026 Mcont.

import type { ArtifactCatalog, MessageDocument } from "@evolutos/mconet-core-domain";

import type { ErasedRuntimeValue } from "./erased-runtime-value.js";
import type { RuntimeComponent } from "./runtime-component.js";

/**
 * Replaceable message-subdomain mapping from a document to a request fragment.
 *
 * Implementations preserve message order, roles, relations, and content while
 * producing one unencoded protocol-native value. `catalog` resolves
 * `content.artifact` references. The mapper may read inline bytes already in
 * that catalog. It does not fetch, choose a protocol, or read a credential.
 * The owning task adapter composes that fragment with task-level fields; byte
 * encoding, authorization, transport, task configuration, and component
 * selection remain outside this mapper.
 */
export interface MessageRequestMapper extends RuntimeComponent {
  /**
   * Maps one validated message document to an unencoded protocol fragment.
   *
   * @param document Message tree to map.
   * @param catalog Catalog that resolves artifact references in `document`.
   */
  mapRequest(document: MessageDocument, catalog: ArtifactCatalog): ErasedRuntimeValue;
}
