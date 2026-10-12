// Copyright © 2026 Mcont.

import type { MediaType, OpenIdentifier } from "@evolutos/mconet-core-domain";
import type { ComponentDescriptor, ComponentTypeContract } from "@evolutos/mconet-core-spi";

/** Diagnostic component name. It is not a registry key or selection identity. */
const JSON_PAYLOAD_ENCODER_NAME = "json-payload-encoder";

/** Descriptive implementation version. It is not the package version. */
const JSON_PAYLOAD_ENCODER_VERSION = "1.0.0";

/**
 * Capability identity that means this component can encode a JSON payload.
 *
 * It is an open identifier, not a component name or a decoder capability.
 */
export const jsonPayloadEncoderCapabilityId: OpenIdentifier = "codec.json.encode";

/**
 * Capability set shared by every encoder descriptor.
 *
 * Membership is the only fact capability resolution reads. The set is not a
 * priority list and it does not select the encoder.
 */
const encoderCapabilities: ReadonlySet<OpenIdentifier> = new Set([jsonPayloadEncoderCapabilityId]);

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
 * a producer must emit that representation. The output port is transport bytes
 * so the runtime can connect this encoder to a Fetch transport.
 */
export const jsonPayloadEncoderTypeContract: ComponentTypeContract = {
  inputTypeId: "json.value",
  outputTypeId: "codec.bytes",
  inputMediaTypes: [jsonMediaType],
};

/**
 * Metadata shared by every JSON payload encoder instance.
 *
 * Name, version, and source are diagnostic facts. The type contract is the
 * encoder input port, and the capability set declares JSON encoding. This value
 * is not a selectable component id and it does not register the encoder.
 */
export const jsonPayloadEncoderDescriptor: ComponentDescriptor = {
  name: JSON_PAYLOAD_ENCODER_NAME,
  version: JSON_PAYLOAD_ENCODER_VERSION,
  typeContract: jsonPayloadEncoderTypeContract,
  capabilities: encoderCapabilities,
  source: "builtin",
};
