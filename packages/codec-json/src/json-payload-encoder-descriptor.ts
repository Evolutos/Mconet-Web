// Copyright © 2026 Mcont.

import type { MediaType, OpenIdentifier } from "@evolutos/mconet-core-domain";
import type { ComponentDescriptor, ComponentTypeContract } from "@evolutos/mconet-core-spi";

/** Diagnostic component name. It is not a registry key or selection identity. */
const JSON_PAYLOAD_ENCODER_NAME = "json-payload-encoder";

/** Descriptive implementation version. It is not the package version. */
const JSON_PAYLOAD_ENCODER_VERSION = "1.0.0";

/**
 * Capability set required by the encoder descriptor.
 *
 * Encode capability is declared in a later step. The set stays shared and empty
 * so instances cannot grow independent capability claims before that declaration.
 */
const encoderCapabilities: ReadonlySet<OpenIdentifier> = new Set();

/** Parameter-free JSON media type accepted on the encoder input port. */
const jsonMediaType: MediaType = {
  type: "application",
  subtype: "json",
  parameters: {},
};

/**
 * Port contract that lets a JSON adapter payload connect to the encoder.
 *
 * The input type is the JSON value port, not a protocol or task identity.
 * Schema identity is omitted so an adapter may declare its own schema and still
 * connect. The media list contains only `application/json` without parameters;
 * a producer must emit that representation. This contract has no output port
 * because the encoder result is transport bytes rather than another JSON value.
 */
export const jsonPayloadEncoderTypeContract: ComponentTypeContract = {
  inputTypeId: "json.value",
  inputMediaTypes: [jsonMediaType],
};

/**
 * Metadata shared by every JSON payload encoder instance.
 *
 * Name, version, and source are diagnostic facts. The type contract is the
 * encoder input port. Encode capability is still absent. This value is not a
 * selectable component id and it does not register the encoder.
 */
export const jsonPayloadEncoderDescriptor: ComponentDescriptor = {
  name: JSON_PAYLOAD_ENCODER_NAME,
  version: JSON_PAYLOAD_ENCODER_VERSION,
  typeContract: jsonPayloadEncoderTypeContract,
  capabilities: encoderCapabilities,
  source: "builtin",
};
