// Copyright © 2026 Mcont.

import type { ModelOutput } from "@evolutos/mconet-core-domain";
import type { InteractionOptions } from "@evolutos/mconet-core-spi";

import { conversationRequest, type ConversationRequestInput } from "./conversation-request.js";
import type { ModelInteractor } from "./model-interactor.js";

/**
 * Sends one text conversation through an interactor.
 *
 * The function builds a model request and calls `interact` once. It does not
 * encode, authorize, or send HTTP itself.
 *
 * @param interactor Call surface that owns execution.
 * @param input Target and text turns.
 * @param options Optional per-call overrides passed through unchanged.
 * @returns The output from that single interact call.
 */
export function interactWithText(
  interactor: ModelInteractor,
  input: ConversationRequestInput,
  options?: InteractionOptions,
): Promise<ModelOutput> {
  const request = conversationRequest(input);
  if (options === undefined) {
    return interactor.interact(request);
  }
  return interactor.interact(request, options);
}
