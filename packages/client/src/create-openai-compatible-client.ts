// Copyright © 2026 Mcont.

import type { ModelTarget, ServiceAccess } from "@evolutos/mconet-core-domain";
import { createOpenAIChatCompletionAdapter } from "@evolutos/mconet-integration-openai-compatible";

import { createDefaultClient } from "./create-default-client.js";
import type { DefaultModelClient } from "./default-model-client.js";

/**
 * Inputs for an OpenAI-compatible client.
 *
 * The target selects the chat-completions protocol and model. Service access
 * supplies the endpoint and authorization. This factory does not read a secret
 * or send a request.
 */
export interface OpenAICompatibleClientInput {
  /** Routing target stored as the client default. */
  readonly target: ModelTarget;

  /** Endpoint and authorization stored as the client default. */
  readonly serviceAccess: ServiceAccess;
}

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
