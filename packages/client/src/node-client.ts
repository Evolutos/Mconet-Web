// Copyright © 2026 Mcont.

import { NodeFetchTransport } from "@evolutos/mconet-transport-fetch-node";

import { assembleDefaultClient, type DefaultClientInput } from "./create-default-client.js";
import type { DefaultModelClient } from "./default-model-client.js";
import { createOpenAIChatIntegrationResolver } from "./openai-chat-integration-resolver.js";
import { createOpenAICompatibleComponents } from "./openai-compatible-components.js";
import type { OpenAICompatibleClientInput } from "./openai-compatible-client-input.js";

/**
 * Creates the Node.js client.
 *
 * The Node Fetch transport is selected here so the browser entry never imports
 * it. An injected transport remains the caller's transport. Construction does
 * not send a request.
 *
 * @param input Protocol adapter and optional domain defaults.
 * @returns A client that can run one text exchange, unary or server stream.
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
 * Composes the chat-completions adapter with the Node Fetch client.
 *
 * The resolver, protocol-port codecs, and three authorization handlers match
 * the browser factory. The call's model target selects the chat binding. This
 * composition lives beside the Node transport so the browser OpenAI factory
 * is not imported into the Node entry.
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
