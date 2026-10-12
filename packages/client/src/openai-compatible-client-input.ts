// Copyright © 2026 Mcont.

import type { ModelTarget, ServiceAccess } from "@evolutos/mconet-core-domain";

/**
 * Inputs for an OpenAI-compatible client.
 *
 * The target selects the chat-completions protocol and model. Service access
 * supplies the endpoint and authorization. The type lives apart from either
 * platform factory so the Node entry can name it without importing the browser
 * factory.
 */
export interface OpenAICompatibleClientInput {
  /** Routing target stored as the client default. */
  readonly target: ModelTarget;

  /** Endpoint and authorization stored as the client default. */
  readonly serviceAccess: ServiceAccess;
}
