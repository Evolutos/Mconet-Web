// Copyright © 2026 Mcont.

import { NoAuthorizationHandler } from "@evolutos/mconet-auth-basic";
import {
  JsonErrorPayloadDecoder,
  JsonPayloadEncoder,
  JsonSuccessPayloadDecoder,
} from "@evolutos/mconet-codec-json";
import type { ResolvedInteractionResourceLimits } from "@evolutos/mconet-core-domain";
import type { ModelClientConfigurationData } from "@evolutos/mconet-core-runtime";
import type { RuntimeComponents, TaskProtocolAdapter } from "@evolutos/mconet-core-spi";
import { BrowserFetchTransport } from "@evolutos/mconet-transport-fetch-browser";

import { DefaultModelClient } from "./default-model-client.js";
import { mapClientComponents } from "./map-client-components.js";

/**
 * Finite SDK byte limits used when a caller does not override a field.
 *
 * These are the composition-root defaults. They are not inferred from a request.
 */
const sdkResourceLimits: ResolvedInteractionResourceLimits = {
  maxResponseBodyBytes: 16_777_216,
  maxStreamingErrorBodyBytes: 1_048_576,
  maxFrameBytes: 2_097_152,
};

/**
 * Inputs for the default JSON and Fetch client.
 *
 * The adapter is the protocol. This factory does not choose an integration.
 * It supplies the JSON codecs, the no-authorization handler, and browser Fetch.
 */
export interface DefaultClientInput {
  /** Protocol adapter used when a call does not supply its own. */
  readonly adapter: TaskProtocolAdapter;

  /** Optional domain defaults stored on the client. */
  readonly clientConfiguration?: ModelClientConfigurationData;

  /**
   * Optional client-tier replacements for the JSON codecs, Fetch transport,
   * or no-authorization handler. A per-call override is not accepted here.
   */
  readonly components?: RuntimeComponents;
}

/**
 * Creates a client whose default components are JSON codecs and Fetch.
 *
 * The transport is the browser Fetch transport, which uses the platform fetch
 * function. A call still goes through the one unary runtime.
 *
 * @param input Protocol adapter and optional domain defaults.
 * @returns A client that can run one unary JSON exchange.
 */
export function createDefaultClient(input: DefaultClientInput): DefaultModelClient {
  const components = mapClientComponents(input.components);
  return new DefaultModelClient({
    clientConfiguration: input.clientConfiguration ?? {},
    sdkResourceLimits,
    adapter: components.adapter ?? input.adapter,
    authorizationHandlers: components.authorizationHandlers ?? [new NoAuthorizationHandler()],
    payloadEncoder: components.payloadEncoder ?? new JsonPayloadEncoder(),
    successPayloadDecoder:
      components.successPayloadDecoder ??
      new JsonSuccessPayloadDecoder(sdkResourceLimits.maxResponseBodyBytes),
    errorPayloadDecoder:
      components.errorPayloadDecoder ??
      new JsonErrorPayloadDecoder(sdkResourceLimits.maxResponseBodyBytes),
    transport: components.transport ?? new BrowserFetchTransport({}),
    ...(components.resolver === undefined ? {} : { resolver: components.resolver }),
    ...(components.serviceAccessResolver === undefined
      ? {}
      : { serviceAccessResolver: components.serviceAccessResolver }),
    ...(components.authorizationHandlerResolver === undefined
      ? {}
      : { authorizationHandlerResolver: components.authorizationHandlerResolver }),
  });
}
