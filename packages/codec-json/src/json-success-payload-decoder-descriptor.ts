// Copyright © 2026 Mcont.

import type { MediaType, OpenIdentifier } from "@evolutos/mconet-core-domain";
import type { ComponentDescriptor, ComponentTypeContract } from "@evolutos/mconet-core-spi";

/** Diagnostic component name. It is not a registry key or selection identity. */
const JSON_SUCCESS_DECODER_NAME = "json-success-payload-decoder";

/** Descriptive implementation version. It is not the package version. */
const JSON_SUCCESS_DECODER_VERSION = "1.0.0";

/**
 * Capability set shared by every success-decoder descriptor.
 *
 * Outcome selection chooses this decoder. It does not publish an encode or
 * decode capability, so capability resolution cannot confuse it with the encoder.
 */
const decoderCapabilities: ReadonlySet<OpenIdentifier> = new Set();

/** Parameter-free JSON media type produced with a decoded success payload. */
const jsonMediaType: MediaType = {
  type: "application",
  subtype: "json",
  parameters: {},
};

/**
 * Port contract for a decoded JSON success payload.
 *
 * The output type matches the value identity this decoder returns. Schema
 * identity is omitted so a consumer can accept the payload without adopting a
 * protocol schema. There is no input port: the decoder consumes bytes, and the
 * connected fact is the success payload it produces.
 */
export const jsonSuccessPayloadDecoderTypeContract: ComponentTypeContract = {
  outputTypeId: "json.value",
  outputMediaTypes: [jsonMediaType],
};

/**
 * Metadata shared by every JSON success payload decoder instance.
 *
 * Name, version, and source are diagnostic facts. The type contract is the
 * success payload port. This value is not a selectable component id and it
 * does not register the decoder.
 */
export const jsonSuccessPayloadDecoderDescriptor: ComponentDescriptor = {
  name: JSON_SUCCESS_DECODER_NAME,
  version: JSON_SUCCESS_DECODER_VERSION,
  typeContract: jsonSuccessPayloadDecoderTypeContract,
  capabilities: decoderCapabilities,
  source: "builtin",
};
