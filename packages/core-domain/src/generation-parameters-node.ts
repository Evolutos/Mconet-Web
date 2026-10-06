// Copyright © 2026 Mcont.

import type { GenerationParameters } from "./generation-parameters.js";
import type { TaskNodeBase } from "./task-node-base.js";

/**
 * Immutable Task leaf carrying protocol-neutral model-generation controls.
 *
 * Generation settings enter the Task tree only through the `parameters`
 * reference. They remain one typed configuration value rather than generic
 * JSON, Message data, child nodes, protocol fields, or executable behavior.
 */
export interface GenerationParametersNode extends TaskNodeBase {
  /** Fixed classification for a model-generation configuration leaf. */
  readonly kind: "task.configuration";

  /** Fixed structural role distinguishing the configuration node as a leaf. */
  readonly composition: "leaf";

  /** Complete protocol-neutral generation controls retained by reference. */
  readonly parameters: GenerationParameters;
}
