// Copyright © 2026 Mcont.

import type {
  Extensions,
  ModelTarget,
  OpenIdentifier,
  Timestamp,
  UriValue,
} from "@evolutos/mconet-core-domain";

/** Absolute endpoint available to an authorization handler after access resolution. */
type AuthorizationEndpoint = Extract<UriValue, { readonly kind: "absolute" }>;

/**
 * Immutable non-sensitive facts available while authorizing one encoded request.
 *
 * The context provides the stable identities, endpoint, signing time, selected
 * transport, supported signing mode, cancellation lifecycle, and JSON-only
 * integration metadata needed by authorization handlers. Credentials,
 * authorization configuration, headers, query fields, bodies, and mutable
 * request state stay outside this object and are supplied through their own
 * narrowly scoped contracts.
 */
export interface AuthorizationContext {
  /** Stable identifier shared by all authorization work for this interaction. */
  readonly interactionId: OpenIdentifier;
  /** Resolved model target whose request is being authorized. */
  readonly target: ModelTarget;
  /** Absolute service endpoint selected before request authorization. */
  readonly endpoint: AuthorizationEndpoint;
  /** Transport family selected by the execution plan. */
  readonly transportKind: OpenIdentifier;
  /** Stable instant used for nonce or signature inputs during this authorization. */
  readonly timestamp: Timestamp;
  /** Body-signing mode supported by the initial unary HTTP implementation. */
  readonly bodySigningMode: "none";
  /** Signal that aborts authorization with the owning interaction. */
  readonly signal: AbortSignal;
  /** Non-sensitive JSON metadata owned by integrations. */
  readonly extensions: Extensions;
}
