// Copyright © 2026 Mcont.

import { createDefaultClient } from "@evolutos/mconet-client";
import type { TaskProtocolAdapter, Transport } from "@evolutos/mconet-core-spi";

/**
 * Application transport injected beside Core.
 *
 * This file does not modify Core. The client accepts the transport through
 * its existing component input, and the byte port matches the JSON codecs.
 */
export function createCountingTransport(): { readonly transport: Transport; sent(): number } {
  let sends = 0;
  return {
    transport: {
      descriptor: {
        name: "counting-transport",
        version: "1.0.0",
        capabilities: new Set(),
        source: "application",
        typeContract: {
          inputTypeId: "codec.bytes",
          outputTypeId: "codec.bytes",
          outputMediaTypes: [{ type: "application", subtype: "json", parameters: {} }],
        },
      },
      send() {
        sends += 1;
        return Promise.resolve({
          metadata: {
            outcome: "success",
            statusCode: 200,
            headers: [],
            mediaType: { type: "application", subtype: "json", parameters: {} },
            extensions: {},
          },
          body: new TextEncoder().encode("{}"),
        });
      },
    },
    sent() {
      return sends;
    },
  };
}

/**
 * Builds a client that uses the injected transport.
 *
 * The adapter is unused at construction. The transport replaces the default
 * Fetch transport without a Core change.
 *
 * @returns A client whose transport is the counting transport.
 */
export function createClientWithCountingTransport() {
  return createDefaultClient({
    adapter: unusedAdapter(),
    components: { transport: createCountingTransport().transport },
  });
}

function unusedAdapter(): TaskProtocolAdapter {
  return {
    descriptor: {
      name: "adapter",
      version: "1.0.0",
      capabilities: new Set(),
      source: "application",
    },
    supports: () => false,
    preparePlan: () => {
      throw new Error("unused");
    },
    buildRequest: () => {
      throw new Error("unused");
    },
    parseResponse: () => {
      throw new Error("unused");
    },
    parseError: () => {
      throw new Error("unused");
    },
  };
}
