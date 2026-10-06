// Copyright © 2026 Mcont.

import type { Extensions } from "./extensions.js";
import type { ModelDescriptor } from "./model-descriptor.js";
import type { OpenIdentifier } from "./open-identifier.js";

/**
 * Immutable interaction target separating service, protocol, and model identity.
 *
 * `serviceId` identifies the model service, while `protocolId` independently
 * selects the interaction protocol. The model descriptor and optional deployment
 * add model-level and service-side routing context without carrying endpoint,
 * authorization, task, or execution-component state. Protocol selection must
 * never be inferred from the model name or an access endpoint.
 */
export interface ModelTarget {
  /** Open identifier of the model service being addressed. */
  readonly serviceId: OpenIdentifier;

  /** Open identifier of the interaction protocol used for adapter selection. */
  readonly protocolId: OpenIdentifier;

  /** Model description passed independently from service and protocol identity. */
  readonly model: ModelDescriptor;

  /** Optional service-side deployment identifier, preserved without interpretation. */
  readonly deploymentId?: string;

  /** Always-present namespaced target extensions for forward-compatible data. */
  readonly extensions: Extensions;
}
