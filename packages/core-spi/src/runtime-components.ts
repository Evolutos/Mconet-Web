// Copyright © 2026 Mcont.

import type { AuthorizationHandler } from "./authorization-handler.js";
import type { AuthorizationHandlerResolver } from "./authorization-handler-resolver.js";
import type { ModelIntegrationResolver } from "./model-integration-resolver.js";
import type { PayloadDecoder } from "./payload-decoder.js";
import type { PayloadEncoder } from "./payload-encoder.js";
import type { ServerStreamReader } from "./server-stream-reader.js";
import type { ServiceAccessResolver } from "./service-access-resolver.js";
import type { TaskProtocolAdapter } from "./task-protocol-adapter.js";
import type { Transport } from "./transport.js";

/**
 * Immutable optional component overrides supplied to one Runtime resolution layer.
 *
 * Each single-value field represents the caller's final choice at that layer;
 * later resolution validates it instead of silently replacing it. Authorization
 * handlers remain an ordered candidate collection because the dedicated resolver
 * determines the unique compatible handler. Server-stream text uses
 * `serverStreamReader`. Client-stream, duplex, Artifact, and operation
 * components stay absent until those paths exist.
 */
export interface RuntimeComponents {
  /** Optional resolver for selecting one complete model integration plan. */
  readonly modelIntegrationResolver?: ModelIntegrationResolver;

  /** Optional direct protocol adapter that bypasses default integration matching. */
  readonly taskProtocolAdapter?: TaskProtocolAdapter;

  /** Optional resolver for merging request and configured service access. */
  readonly serviceAccessResolver?: ServiceAccessResolver;

  /** Optional encoder for converting the planned request payload into a body. */
  readonly payloadEncoder?: PayloadEncoder;

  /** Optional decoder reserved for successful transport outcomes. */
  readonly successPayloadDecoder?: PayloadDecoder;

  /** Optional decoder reserved for service-error transport outcomes. */
  readonly errorPayloadDecoder?: PayloadDecoder;

  /** Optional transport for sending the fully encoded and authorized request. */
  readonly transport?: Transport;

  /** Optional reader for a text `server_stream` response. Unary calls ignore it. */
  readonly serverStreamReader?: ServerStreamReader;

  /** Optional resolver that selects exactly one compatible authorization handler. */
  readonly authorizationHandlerResolver?: AuthorizationHandlerResolver;

  /** Ordered read-only authorization handler candidates supplied at this layer. */
  readonly authorizationHandlers?: readonly AuthorizationHandler[];
}
