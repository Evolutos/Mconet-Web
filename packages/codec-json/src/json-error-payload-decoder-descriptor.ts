// Copyright © 2026 Mcont.

import type { MediaType, OpenIdentifier } from "@evolutos/mconet-core-domain";
import type { ComponentDescriptor, ComponentTypeContract } from "@evolutos/mconet-core-spi";

/** Diagnostic component name. It is not a registry key or selection identity. */
const JSON_ERROR_DECODER_NAME = "json-error-payload-decoder";

/** Descriptive implementation version. It is not the package version. */
const JSON_ERROR_DECODER_VERSION = "1.0.0";

/**
 * Capability set shared by every error-decoder descriptor.
 *
 * Outcome selection chooses this decoder. It does not publish an encode or
 * decode capability, so capability resolution cannot treat it as the encoder.
 */
const decoderCapabilities: ReadonlySet<OpenIdentifier> = new Set();

/** Parameter-free JSON media type produced with a decoded error payload. */
const jsonMediaType: MediaType = {
  type: "application",
  subtype: "json",
  parameters: {},
};

/**
 * Port contract for a decoded JSON error payload.
 *
 * The output type matches the value identity this decoder returns. Schema
 * identity is omitted so a consumer can accept the provider error document
 * without adopting a protocol schema. The input port is transport bytes of
 * `application/json`. The object stays independent from the success contract.
 */
export const jsonErrorPayloadDecoderTypeContract: ComponentTypeContract = {
  inputTypeId: "codec.bytes",
  outputTypeId: "json.value",
  inputMediaTypes: [jsonMediaType],
  outputMediaTypes: [jsonMediaType],
};

/**
 * Metadata shared by every JSON error payload decoder instance.
 *
 * Name, version, and source are diagnostic facts. The type contract is the
 * error payload port. This value is distinct from the success decoder
 * descriptor and is not a selectable component id.
 */
export const jsonErrorPayloadDecoderDescriptor: ComponentDescriptor = {
  name: JSON_ERROR_DECODER_NAME,
  version: JSON_ERROR_DECODER_VERSION,
  typeContract: jsonErrorPayloadDecoderTypeContract,
  capabilities: decoderCapabilities,
  source: "builtin",
};
