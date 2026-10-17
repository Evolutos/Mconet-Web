// Copyright © 2026 Mcont.

import { createDefaultClient } from "./browser-client.js";
import type { DefaultModelClient } from "./default-model-client.js";
import { createOpenAIChatIntegrationResolver } from "./openai-chat-integration-resolver.js";
import { createOpenAICompatibleComponents } from "./openai-compatible-components.js";
import type { OpenAICompatibleClientInput } from "./openai-compatible-client-input.js";

export type { OpenAICompatibleClientInput } from "./openai-compatible-client-input.js";

/**
 * Composes browser Fetch with a resolver that reads the model target.
 *
 * The target `protocolId` and task type select the chat binding. The model
 * name is not a selector. Unary stays the default; `stream()` uses
 * `server_stream` on the same runtime. The request and success ports are the
 * chat-completions protocol ports, so the generic `json.value` codecs are
 * replaced before the runtime connects the plan. The error decoder stays the
 * generic JSON decoder. No authorization, an API-key header, and Bearer are
 * all installed; the service-access kind selects one.
 *
 * @param input Default target and service access.
 * @returns A client whose adapter is the chat-completions adapter.
 */
export function createOpenAICompatibleClient(
  input: OpenAICompatibleClientInput,
): DefaultModelClient {
  return createDefaultClient({
    clientConfiguration: {
      defaultTarget: input.target,
      defaultServiceAccess: input.serviceAccess,
    },
    components: {
      ...createOpenAICompatibleComponents(),
      modelIntegrationResolver: createOpenAIChatIntegrationResolver(),
    },
  });
}
