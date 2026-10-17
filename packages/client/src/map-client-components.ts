// Copyright © 2026 Mcont.

import type { RuntimeComponents } from "@evolutos/mconet-core-spi";

import type { DefaultModelClientDependencies } from "./default-model-client.js";

/**
 * Client-tier components copied from one configuration.
 *
 * Absent fields are omitted so a factory can keep its own default for that role.
 * The mapper does not call a component or merge a per-call override.
 */
export type ClientComponentSelection = Partial<
  Pick<
    DefaultModelClientDependencies,
    | "adapter"
    | "resolver"
    | "serviceAccessResolver"
    | "authorizationHandlerResolver"
    | "authorizationHandlers"
    | "payloadEncoder"
    | "successPayloadDecoder"
    | "errorPayloadDecoder"
    | "transport"
    | "serverStreamReader"
  >
>;

/**
 * Copies client-configuration components into the client tier.
 *
 * Each present component is kept by identity. Omitted components are omitted
 * here rather than replaced. Interaction options are not read.
 *
 * @param components Client configuration components, when the caller supplied them.
 * @returns The client tier. An empty object means every role keeps the factory default.
 */
export function mapClientComponents(
  components: RuntimeComponents | undefined,
): ClientComponentSelection {
  if (components === undefined) {
    return {};
  }
  return {
    ...(components.taskProtocolAdapter === undefined
      ? {}
      : { adapter: components.taskProtocolAdapter }),
    ...(components.modelIntegrationResolver === undefined
      ? {}
      : { resolver: components.modelIntegrationResolver }),
    ...(components.serviceAccessResolver === undefined
      ? {}
      : { serviceAccessResolver: components.serviceAccessResolver }),
    ...(components.authorizationHandlerResolver === undefined
      ? {}
      : { authorizationHandlerResolver: components.authorizationHandlerResolver }),
    ...(components.authorizationHandlers === undefined
      ? {}
      : { authorizationHandlers: components.authorizationHandlers }),
    ...(components.payloadEncoder === undefined
      ? {}
      : { payloadEncoder: components.payloadEncoder }),
    ...(components.successPayloadDecoder === undefined
      ? {}
      : { successPayloadDecoder: components.successPayloadDecoder }),
    ...(components.errorPayloadDecoder === undefined
      ? {}
      : { errorPayloadDecoder: components.errorPayloadDecoder }),
    ...(components.transport === undefined ? {} : { transport: components.transport }),
    ...(components.serverStreamReader === undefined
      ? {}
      : { serverStreamReader: components.serverStreamReader }),
  };
}
