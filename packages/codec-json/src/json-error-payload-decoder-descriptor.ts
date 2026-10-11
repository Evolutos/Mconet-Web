// Copyright © 2026 Mcont.

import type { OpenIdentifier } from "@evolutos/mconet-core-domain";
import type { ComponentDescriptor } from "@evolutos/mconet-core-spi";

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

/**
 * Metadata shared by every JSON error payload decoder instance.
 *
 * Name, version, and source are diagnostic facts. The port contract is added
 * separately. This value is distinct from the success decoder descriptor and
 * is not a selectable component id.
 */
export const jsonErrorPayloadDecoderDescriptor: ComponentDescriptor = {
  name: JSON_ERROR_DECODER_NAME,
  version: JSON_ERROR_DECODER_VERSION,
  capabilities: decoderCapabilities,
  source: "builtin",
};
