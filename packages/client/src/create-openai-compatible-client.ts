// Copyright © 2026 Mcont.

import { createOpenAIChatCompletionAdapter } from "@evolutos/mconet-integration-openai-compatible";

import { createDefaultClient } from "./browser-client.js";
import type { DefaultModelClient } from "./default-model-client.js";
import type { OpenAICompatibleClientInput } from "./openai-compatible-client-input.js";

export type { OpenAICompatibleClientInput } from "./openai-compatible-client-input.js";

/**
 * Composes the chat-completions adapter with the default JSON and Fetch client.
 *
 * No other integration is installed. Execution remains the unary runtime.
 *
 * @param input Default target and service access.
 * @returns A client whose adapter is the chat-completions adapter.
 */
export function createOpenAICompatibleClient(
  input: OpenAICompatibleClientInput,
): DefaultModelClient {
  return createDefaultClient({
    adapter: createOpenAIChatCompletionAdapter(),
    clientConfiguration: {
      defaultTarget: input.target,
      defaultServiceAccess: input.serviceAccess,
    },
  });
}
