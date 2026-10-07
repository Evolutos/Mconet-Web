// Copyright © 2026 Mcont.

import type { OpenIdentifier } from "@evolutos/mconet-core-domain";

/**
 * Protocol-neutral classification reported by a transport operation.
 *
 * Standard literals distinguish a usable response, a response carrying a
 * service-level failure, and a transport-level failure observation. The open
 * identifier arm preserves future or integration-defined outcomes exactly.
 * Native status, headers, media type, request identity, and body remain separate
 * response facts and cannot be inferred or stored by this representation type.
 */
export type TransportOutcome =
  "success" | "service_error" | "transport_error" | (OpenIdentifier & Record<never, never>);
