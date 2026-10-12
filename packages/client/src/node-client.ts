// Copyright © 2026 Mcont.

import { createOpenAIChatCompletionAdapter } from "@evolutos/mconet-integration-openai-compatible";
import { NodeFetchTransport } from "@evolutos/mconet-transport-fetch-node";

import { assembleDefaultClient, type DefaultClientInput } from "./create-default-client.js";
import type { OpenAICompatibleClientInput } from "./openai-compatible-client-input.js";
import type { DefaultModelClient } from "./default-model-client.js";

/**
 * Creates the Node.js client.
 *
 * The Node Fetch transport is selected here so the browser entry never imports
 * it. An injected transport remains the caller's transport. Construction does
 * not send a request.
 *
 * @param input Protocol adapter and optional domain defaults.
 * @returns A client that can run one unary JSON exchange.
 */
export function createDefaultClient(input: DefaultClientInput): DefaultModelClient {
  const transport = input.components?.transport ?? new NodeFetchTransport();
  return assembleDefaultClient({
    ...input,
    components: {
      ...input.components,
      transport,
    },
  });
}

/**
 * Composes the chat-completions adapter with the Node JSON and Fetch client.
 *
 * This composition lives beside the Node transport so the browser OpenAI
 * factory is not imported into the Node entry.
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
