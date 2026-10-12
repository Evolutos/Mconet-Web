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
export { DefaultModelClient } from "./default-model-client.js";
export type { DefaultModelClientDependencies } from "./default-model-client.js";
export type { ModelClient } from "./model-client.js";
export type { ModelInteractor } from "./model-interactor.js";
