// Copyright © 2026 Mcont.

import type { ModelRequest } from "@evolutos/mconet-core-domain";

import type { InteractionOptionsData } from "./interaction-options-data.js";

/**
 * Immutable facts for one model interaction.
 *
 * The context exists only for that interaction. It is not a field of reusable
 * client configuration, and creating one does not retain it for a later call.
 */
export interface InteractionContext {
  /** Request being executed. */
  readonly request: ModelRequest;

  /** Interaction-only options. An omitted options bag stays empty. */
  readonly options: InteractionOptionsData;
}

/** Shared empty options. Frozen so one context cannot add an option to another. */
const emptyOptions: InteractionOptionsData = Object.freeze({});

/**
 * Creates the context for one interaction.
 *
 * The request and a supplied options bag are kept by reference, so a caller
 * signal remains the same signal. No module state records the context.
 *
 * @param input Request and optional interaction options.
 * @returns A frozen context that is not stored on a client.
 */
export function createInteractionContext(input: {
  readonly request: ModelRequest;
  readonly options?: InteractionOptionsData;
}): InteractionContext {
  if (typeof input.request !== "object" || input.request === null) {
    throw new TypeError("Interaction context requires a model request.");
  }
  return Object.freeze({
    request: input.request,
    options: input.options ?? emptyOptions,
  });
}
