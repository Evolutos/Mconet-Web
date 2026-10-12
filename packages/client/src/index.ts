// Copyright © 2026 Mcont.

/**
 * Public module boundary for the Mconet client facade.
 *
 * The interactor names the single call operation, and the client adds close.
 * `DefaultModelClient.interact` enters the unary runtime. Construction helpers
 * and platform transports stay out of this entry until their own steps add them.
 */
export { DefaultModelClient } from "./default-model-client.js";
export type { DefaultModelClientDependencies } from "./default-model-client.js";
export type { ModelClient } from "./model-client.js";
export type { ModelInteractor } from "./model-interactor.js";
