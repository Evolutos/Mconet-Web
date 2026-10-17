// Copyright © 2026 Mcont.

/**
 * Browser export condition for the public client.
 *
 * A bundler that sets the browser condition loads this module instead of the
 * Node entry. The re-exported factories bind the browser Fetch transport. This
 * file does not import the Node Fetch transport.
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
export { streamText } from "./stream-text.js";
export type { ConversationMessage, ConversationRequestInput } from "./conversation-request.js";
export { DefaultModelClient } from "./default-model-client.js";
export type { DefaultModelClientDependencies } from "./default-model-client.js";
export type { ModelClient } from "./model-client.js";
export type { TextStreamEvent, TextStreamInteraction } from "./text-stream-interaction.js";
export type { RawResponseSnapshot } from "./raw-response-snapshot.js";
export { redactRawResponse } from "./redact-raw-response.js";
export type { ModelInteractor } from "./model-interactor.js";
