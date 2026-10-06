// Copyright © 2026 Mcont.

import type { MessageContentBase } from "./message-content-base.js";
import type { OpenIdentifier } from "./open-identifier.js";
import type { RawPayload } from "./raw-payload.js";

/**
 * Immutable message content preserved without a typed semantic representation.
 *
 * The open kind retains standard-but-unsupported, integration-defined, and
 * future content identities. Optional bounded raw data preserves source bytes
 * when available without claiming they are text, JSON, an artifact, or safe to
 * render. Size validation and byte ownership follow the RawPayload contract.
 */
export interface UnknownMessageContent extends MessageContentBase {
  /** Original standard or integration-defined content classification. */
  readonly kind: OpenIdentifier;

  /** Optional bounded source payload retained without semantic interpretation. */
  readonly raw?: RawPayload;
}
