// Copyright © 2026 Mcont.

import type { CompatibilityMode, OpenIdentifier } from "@evolutos/mconet-core-domain";

/**
 * Immutable non-sensitive summary of resolved interaction configuration.
 *
 * The snapshot keeps only identifiers and finite execution metadata useful to
 * monitoring. It deliberately replaces service access and cancellation objects
 * with safe scalar summaries. Endpoint text, header and query values, model
 * metadata, extensions, authorization payloads, credential sources, signals,
 * and secret values therefore have no representable field in this contract.
 *
 * A dedicated mapper owns extraction and copying in a later implementation
 * step; this type neither reads configuration nor claims runtime sanitization.
 */
export type SafeConfigurationSnapshot = Readonly<{
  /** Service identity selected for this interaction. */
  serviceId: OpenIdentifier;

  /** Protocol identity selected independently from the service. */
  protocolId: OpenIdentifier;

  /** Protocol-facing model name without model metadata or extensions. */
  modelName: string;

  /** Optional deployment identity, represented as an explicit absence state. */
  deploymentId: string | undefined;

  /** Authorization discriminator only, never its scheme-specific payload. */
  authorizationKind: OpenIdentifier | undefined;

  /** Effective compatibility mode without retaining the policy object. */
  compatibilityMode: CompatibilityMode;

  /** Maximum bytes accepted for one complete unary response body. */
  maxResponseBodyBytes: number;

  /** Maximum bytes collected from an initial streaming error response. */
  maxStreamingErrorBodyBytes: number;

  /** Maximum encoded bytes accepted for one framed streaming event. */
  maxFrameBytes: number;

  /** Whether resolved configuration contains a service access object. */
  hasServiceAccess: boolean;

  /** Whether resolved configuration observes a caller cancellation signal. */
  hasSignal: boolean;
}>;
