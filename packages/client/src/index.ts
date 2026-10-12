// Copyright © 2026 Mcont.

/**
 * Public module boundary for the Mconet client facade.
 *
 * The interactor names the single call operation, and the client adds close.
 * `DefaultModelClient.interact` enters the unary runtime. The conversation task
 * builder is the domain builder, re-exported so a public caller can build the
 * same task value as a literal. Platform transports stay out of this entry.
 */
export { ConversationTaskBuilder } from "@evolutos/mconet-core-domain";
export { createDefaultClient } from "./create-default-client.js";
export { createOpenAICompatibleClient } from "./create-openai-compatible-client.js";
export type { OpenAICompatibleClientInput } from "./create-openai-compatible-client.js";
export type { DefaultClientInput } from "./create-default-client.js";
export { conversationRequest } from "./conversation-request.js";
export { interactWithText } from "./interact-with-text.js";
export type { ConversationMessage, ConversationRequestInput } from "./conversation-request.js";
export { DefaultModelClient } from "./default-model-client.js";
export type { DefaultModelClientDependencies } from "./default-model-client.js";
export type { ModelClient } from "./model-client.js";
export type { RawResponseSnapshot } from "./raw-response-snapshot.js";
export { redactRawResponse } from "./redact-raw-response.js";
export type { ModelInteractor } from "./model-interactor.js";
