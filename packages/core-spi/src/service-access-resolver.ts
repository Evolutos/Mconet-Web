// Copyright © 2026 Mcont.

import type { ResolvedServiceAccess, ServiceAccess } from "@evolutos/mconet-core-domain";

import type { RuntimeComponent } from "./runtime-component.js";

/**
 * Replaceable pure behavior that resolves layered service access configuration.
 *
 * The resolver applies documented precedence without mutating or writing back to
 * any source layer. It resolves fields into one complete immutable snapshot and
 * treats authorization atomically; it must not read credentials, build protocol
 * requests, apply headers to a transport request, or perform network I/O.
 */
export interface ServiceAccessResolver extends RuntimeComponent {
  /** Resolves four precedence layers into one complete access snapshot. */
  resolve(input: {
    readonly interactionOverride?: ServiceAccess;
    readonly requestAccess?: ServiceAccess;
    readonly clientDefault?: ServiceAccess;
    readonly integrationDefault?: ServiceAccess;
  }): ResolvedServiceAccess;
}
