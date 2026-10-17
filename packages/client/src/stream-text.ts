// Copyright © 2026 Mcont.

import type { InteractionOptions } from "@evolutos/mconet-core-spi";

import { conversationRequest, type ConversationRequestInput } from "./conversation-request.js";
import type { ModelClient } from "./model-client.js";
import type { TextStreamInteraction } from "./text-stream-interaction.js";

/**
 * Sends one text conversation as a server stream.
 *
 * The function builds a model request and calls `stream` once. `interactWithText`
 * stays the unary call. This function does not encode, authorize, or send HTTP.
 *
 * @param client Call surface that owns execution.
 * @param input Target and text turns.
 * @param options Optional per-call overrides. This call uses `server_stream`.
 * @returns Fragment events and the assembled output.
 */
export function streamText(
  client: ModelClient,
  input: ConversationRequestInput,
  options?: InteractionOptions,
): TextStreamInteraction {
  const request = conversationRequest(input);
  if (options === undefined) {
    return client.stream(request);
  }
  return client.stream(request, options);
}
