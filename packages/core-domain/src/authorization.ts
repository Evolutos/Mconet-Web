// Copyright © 2026 Mcont.

import type { OpenIdentifier } from "./open-identifier.js";

/**
 * Open description of an authorization scheme selected by its stable kind.
 *
 * This base contract carries only the discriminator required to select a
 * compatible authorization handler. Concrete schemes may add their own typed
 * configuration structurally, but plaintext credentials, transport headers,
 * service endpoints, and handler behavior do not belong to this abstraction.
 * Runtime data still requires validation at its trust boundary.
 */
export interface Authorization {
  /** Open identifier used to select a compatible authorization handler. */
  readonly kind: OpenIdentifier;
}
