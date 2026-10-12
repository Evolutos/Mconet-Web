// Copyright © 2026 Mcont.

import { isOpenIdentifier } from "@evolutos/mconet-core-domain";

/**
 * Internal identity of one integration binding.
 *
 * Protocol, task type, and interaction mode stay separate fields. A model name
 * is not part of the key and cannot select a binding.
 */
export interface IntegrationTypeKey {
  /** Protocol id, such as `openai.chat.completions`. */
  readonly protocolId: string;

  /** Task type, such as `conversation.generate`. */
  readonly taskType: string;

  /** Interaction mode id, such as `unary`. */
  readonly modeId: string;
}

/**
 * Creates a frozen integration key from the three selecting fields.
 *
 * Each field must be an open identifier. The function does not read a model
 * name, a service id, or an endpoint, and it does not join the fields into one
 * string. Serialization belongs to a later step.
 *
 * @param input Protocol, task type, and mode.
 * @returns The frozen key.
 * @throws TypeError When a field is not an open identifier.
 */
export function createIntegrationTypeKey(input: {
  readonly protocolId: string;
  readonly taskType: string;
  readonly modeId: string;
}): IntegrationTypeKey {
  assertIdentifier(input.protocolId, "protocolId");
  assertIdentifier(input.taskType, "taskType");
  assertIdentifier(input.modeId, "modeId");
  return Object.freeze({
    protocolId: input.protocolId,
    taskType: input.taskType,
    modeId: input.modeId,
  });
}

/**
 * Rejects a field that cannot be an open identifier.
 *
 * @param value Candidate field value.
 * @param name Field name used in the failure.
 */
function assertIdentifier(value: string, name: string): void {
  // The failure text names the field only. The rejected spelling is omitted.
  if (!isOpenIdentifier(value)) {
    throw new TypeError(`Integration type key ${name} must be an open identifier.`);
  }
}
