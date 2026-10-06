// Copyright © 2026 Mcont.

import type { OpenIdentifier } from "./open-identifier.js";
import type { RawPayload } from "./raw-payload.js";
import type { TaskNodeBase } from "./task-node-base.js";

/**
 * Immutable Task leaf preserved without a typed domain representation.
 *
 * The open kind retains standard-but-unsupported, integration-defined, and
 * future leaf identities. Optional bounded raw data preserves source bytes when
 * available without treating arbitrary values as task configuration. Unknown
 * containers use TaskGroupNode's open kind and ordered children instead.
 */
export interface UnknownTaskNode extends TaskNodeBase {
  /** Original standard or integration-defined Task-node classification. */
  readonly kind: OpenIdentifier;

  /** Fixed structural role identifying the unknown node as a leaf. */
  readonly composition: "leaf";

  /** Optional bounded source payload retained without semantic interpretation. */
  readonly raw?: RawPayload;
}
