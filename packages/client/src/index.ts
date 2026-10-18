// Copyright © 2026 Mcont.

/**
 * Public module boundary for the Mconet client facade.
 *
 * The interactor names the unary call. The client adds `stream` and close.
 * Both calls enter the same text runtime. The conversation task
 * builder is the domain builder, re-exported so a public caller can build the
 * same task value as a literal. The default entry uses the browser Fetch
 * client. The node export condition selects `node.ts`, which supplies the Node
 * Fetch transport without importing this browser choice.
 */
export { ConversationTaskBuilder } from "@evolutos/mconet-core-domain";
export { createDefaultClient } from "./browser-client.js";
export { mapClientComponents } from "./map-client-components.js";
export type { ClientComponentSelection } from "./map-client-components.js";
export { createOpenAICompatibleClient } from "./create-openai-compatible-client.js";
export type { OpenAICompatibleClientInput } from "./create-openai-compatible-client.js";
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
