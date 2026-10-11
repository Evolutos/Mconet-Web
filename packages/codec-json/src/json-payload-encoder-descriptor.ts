// Copyright © 2026 Mcont.

import type { OpenIdentifier } from "@evolutos/mconet-core-domain";
import type { ComponentDescriptor } from "@evolutos/mconet-core-spi";

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

/**
 * Metadata shared by every JSON payload encoder instance.
 *
 * Name, version, and source are diagnostic facts. This descriptor has no port
 * contract yet, so it cannot be used to prove an adapter connection. It is not
 * a selectable component id and it does not register the encoder.
 */
export const jsonPayloadEncoderDescriptor: ComponentDescriptor = {
  name: JSON_PAYLOAD_ENCODER_NAME,
  version: JSON_PAYLOAD_ENCODER_VERSION,
  capabilities: encoderCapabilities,
  source: "builtin",
};
