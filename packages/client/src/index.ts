// Copyright © 2026 Mcont.

/**
 * Public module boundary for the Mconet client facade.
 *
 * The interactor names the single call operation, and the client adds close.
 * Construction, default component assembly, and platform transports stay out
 * of this entry until their own steps add them.
 */
export type { ModelClient } from "./model-client.js";
export type { ModelInteractor } from "./model-interactor.js";
