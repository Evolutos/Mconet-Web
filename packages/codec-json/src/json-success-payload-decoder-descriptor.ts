// Copyright © 2026 Mcont.

import type { OpenIdentifier } from "@evolutos/mconet-core-domain";
import type { ComponentDescriptor } from "@evolutos/mconet-core-spi";

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

/**
 * Metadata shared by every JSON success payload decoder instance.
 *
 * Name, version, and source are diagnostic facts. The port contract is added
 * separately. This value is not a selectable component id and it does not
 * register the decoder.
 */
export const jsonSuccessPayloadDecoderDescriptor: ComponentDescriptor = {
  name: JSON_SUCCESS_DECODER_NAME,
  version: JSON_SUCCESS_DECODER_VERSION,
  capabilities: decoderCapabilities,
  source: "builtin",
};
