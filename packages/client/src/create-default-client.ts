// Copyright © 2026 Mcont.

import { NoAuthorizationHandler } from "@evolutos/mconet-auth-basic";
import {
  JsonErrorPayloadDecoder,
  JsonPayloadEncoder,
  JsonSuccessPayloadDecoder,
} from "@evolutos/mconet-codec-json";
import type { ResolvedInteractionResourceLimits } from "@evolutos/mconet-core-domain";
import {
  validateComponentTypeConnection,
  type ModelClientConfigurationData,
} from "@evolutos/mconet-core-runtime";
import type {
  RuntimeComponent,
  RuntimeComponents,
  TaskProtocolAdapter,
} from "@evolutos/mconet-core-spi";

import { DefaultModelClient } from "./default-model-client.js";
import { mapClientComponents } from "./map-client-components.js";

/**
 * Finite SDK byte limits used when a caller does not override a field.
 *
 * These are the composition-root defaults. They are not inferred from a request.
 */
/**
 * Rejects a component that does not expose the method its role requires.
 *
 * Construction fails before a request exists. The check does not call the method.
 *
 * @param component Candidate component.
 * @param methodName Method the role must provide.
 */
function assertRole(component: RuntimeComponent, methodName: string): void {
  const method = Reflect.get(component, methodName);
  if (
    typeof component.descriptor !== "object" ||
    component.descriptor === null ||
    typeof method !== "function"
  ) {
    throw new TypeError(`The ${methodName} component does not satisfy its role.`);
  }
}

/** Response, error, and frame limits used when a call does not override them. */
export const sdkResourceLimits: ResolvedInteractionResourceLimits = {
  maxResponseBodyBytes: 16_777_216,
  maxStreamingErrorBodyBytes: 1_048_576,
  maxFrameBytes: 2_097_152,
};

/**
 * Inputs for the default JSON and Fetch client.
 *
 * A supplied adapter is the protocol for every call. When it is omitted, a
 * resolver in `components` selects the protocol from the model target. This
 * factory does not infer a protocol from a model name.
 */
export interface DefaultClientInput {
  /**
   * Explicit protocol adapter. When present, integration resolution is skipped.
   */
  readonly adapter?: TaskProtocolAdapter;

  /** Optional domain defaults stored on the client. */
  readonly clientConfiguration?: ModelClientConfigurationData;

  /**
   * Optional client-tier replacements for the JSON codecs, Fetch transport,
   * or no-authorization handler. A per-call override is not accepted here.
   */
  readonly components?: RuntimeComponents;
}

/**
 * Assembles a client from JSON codecs and a caller-supplied transport.
 *
 * This module is shared by the browser and Node entries, so it must not choose
 * a Fetch implementation. The platform entry supplies the transport before
 * any request exists. Unary and server-stream text calls share one runtime.
 *
 * @param input Protocol adapter, transport, and optional domain defaults.
 * @returns A client that can run one text exchange.
 */
export function assembleDefaultClient(input: DefaultClientInput): DefaultModelClient {
  const components = mapClientComponents(input.components);
  const adapter = components.adapter ?? input.adapter;
  const resolver = components.resolver;
  if (adapter === undefined && resolver === undefined) {
    throw new TypeError("The client requires a protocol adapter or an integration resolver.");
  }
  const authorizationHandlers = components.authorizationHandlers ?? [new NoAuthorizationHandler()];
  const payloadEncoder = components.payloadEncoder ?? new JsonPayloadEncoder();
  const successPayloadDecoder =
    components.successPayloadDecoder ??
    new JsonSuccessPayloadDecoder(sdkResourceLimits.maxResponseBodyBytes);
  const errorPayloadDecoder =
    components.errorPayloadDecoder ??
    new JsonErrorPayloadDecoder(sdkResourceLimits.maxResponseBodyBytes);
  const transport = components.transport;
  if (transport === undefined) {
    throw new TypeError("The send component does not satisfy its role.");
  }
  if (adapter !== undefined) {
    assertRole(adapter, "supports");
  }
  if (resolver !== undefined) {
    assertRole(resolver, "resolve");
  }
  assertRole(payloadEncoder, "encode");
  assertRole(successPayloadDecoder, "decode");
  assertRole(errorPayloadDecoder, "decode");
  assertRole(transport, "send");
  if (components.serverStreamReader !== undefined) {
    assertRole(components.serverStreamReader, "read");
  }
  for (const handler of authorizationHandlers) {
    assertRole(handler, "apply");
  }
  const encoderContract = payloadEncoder.descriptor.typeContract ?? {};
  const transportContract = transport.descriptor.typeContract ?? {};
  validateComponentTypeConnection({ producer: encoderContract, consumer: transportContract });
  validateComponentTypeConnection({
    producer: transportContract,
    consumer: successPayloadDecoder.descriptor.typeContract ?? {},
  });
  validateComponentTypeConnection({
    producer: transportContract,
    consumer: errorPayloadDecoder.descriptor.typeContract ?? {},
  });
  return new DefaultModelClient({
    clientConfiguration: input.clientConfiguration ?? {},
    sdkResourceLimits,
    ...(adapter === undefined ? {} : { adapter }),
    ...(resolver === undefined ? {} : { resolver }),
    authorizationHandlers,
    payloadEncoder,
    successPayloadDecoder,
    errorPayloadDecoder,
    transport,
    ...(components.serverStreamReader === undefined
      ? {}
      : { serverStreamReader: components.serverStreamReader }),
    ...(components.serviceAccessResolver === undefined
      ? {}
      : { serviceAccessResolver: components.serviceAccessResolver }),
    ...(components.authorizationHandlerResolver === undefined
      ? {}
      : { authorizationHandlerResolver: components.authorizationHandlerResolver }),
  });
}
