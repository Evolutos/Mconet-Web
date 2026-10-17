// Copyright © 2026 Mcont.

import { BrowserFetchTransport } from "@evolutos/mconet-transport-fetch-browser";

import { assembleDefaultClient, type DefaultClientInput } from "./create-default-client.js";
import type { DefaultModelClient } from "./default-model-client.js";

/**
 * Creates the browser client.
 *
 * The browser Fetch transport is selected here, before a request exists, so
 * the shared assembler never imports a platform package. An injected transport
 * remains the caller's transport.
 *
 * @param input Protocol adapter and optional domain defaults.
 * @returns A client that can run one text exchange, unary or server stream.
 */
export function createDefaultClient(input: DefaultClientInput): DefaultModelClient {
  const transport = input.components?.transport ?? new BrowserFetchTransport({});
  return assembleDefaultClient({
    ...input,
    components: {
      ...input.components,
      transport,
    },
  });
}
