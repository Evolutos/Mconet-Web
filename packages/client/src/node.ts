// Copyright © 2026 Mcont.

/**
 * Node.js export condition for the public client.
 *
 * Node selects this module instead of the browser entry. The factories bind
 * the Node Fetch transport. The neutral client surface is re-exported from the
 * same modules as the browser entry, without importing that entry.
 */
export { ConversationTaskBuilder } from "@evolutos/mconet-core-domain";
export { createDefaultClient, createOpenAICompatibleClient } from "./node-client.js";
export { mapClientComponents } from "./map-client-components.js";
export type { ClientComponentSelection } from "./map-client-components.js";
export type { OpenAICompatibleClientInput } from "./openai-compatible-client-input.js";
export type { DefaultClientInput } from "./create-default-client.js";
export { conversationRequest } from "./conversation-request.js";
export { interactWithText } from "./interact-with-text.js";
export { interactWithTools } from "./interact-with-tools.js";
export { streamText } from "./stream-text.js";
export type {
  ConversationImage,
  ConversationMessage,
  ConversationRequestInput,
  ConversationTool,
} from "./conversation-request.js";
export type { ExecutableConversationTool } from "./interact-with-tools.js";
export { projectConversationToolCalls } from "@evolutos/mconet-core-domain";
export { DefaultModelClient } from "./default-model-client.js";
export type { DefaultModelClientDependencies } from "./default-model-client.js";
export type { ModelClient } from "./model-client.js";
export type { TextStreamEvent, TextStreamInteraction } from "./text-stream-interaction.js";
export type { RawResponseSnapshot } from "./raw-response-snapshot.js";
export { redactRawResponse } from "./redact-raw-response.js";
export type { ModelInteractor } from "./model-interactor.js";
