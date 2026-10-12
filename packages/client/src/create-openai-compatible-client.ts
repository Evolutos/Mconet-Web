// Copyright © 2026 Mcont.

import { createOpenAIChatCompletionAdapter } from "@evolutos/mconet-integration-openai-compatible";

import { createDefaultClient } from "./browser-client.js";
import type { DefaultModelClient } from "./default-model-client.js";
import { createOpenAICompatibleComponents } from "./openai-compatible-components.js";
import type { OpenAICompatibleClientInput } from "./openai-compatible-client-input.js";

export type { OpenAICompatibleClientInput } from "./openai-compatible-client-input.js";

/**
 * Composes the chat-completions adapter with browser Fetch.
 *
 * The request and success ports are the chat-completions protocol ports, so
 * the generic `json.value` codecs are replaced before the runtime connects the
 * plan. The error decoder stays the generic JSON decoder. No other integration
 * is installed, and execution remains the unary runtime.
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
    components: createOpenAICompatibleComponents(),
  });
}
