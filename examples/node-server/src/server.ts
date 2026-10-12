// Copyright © 2026 Mcont.

import { createServer } from "node:http";

import { BearerAuthorizationHandler, bearerAuthorizationKind } from "@evolutos/mconet-auth-basic";
import { createDefaultClient } from "@evolutos/mconet-client";
import { SecretValue } from "@evolutos/mconet-core-domain";
import type { CredentialSource } from "@evolutos/mconet-core-spi";
import { createOpenAIChatCompletionAdapter } from "@evolutos/mconet-integration-openai-compatible";

/**
 * Node server entry.
 *
 * Node's package condition selects the Node Fetch client. The vendor credential
 * is read from this process environment and is never written into a response.
 * A browser bundle is not part of this example.
 */
const providerTarget = {
  serviceId: "provider.example",
  protocolId: "openai.chat.completions",
  model: { name: "vendor-model", metadata: {}, extensions: {} },
  extensions: {},
} as const;

/**
 * Reads the vendor credential from the server environment.
 *
 * @returns The server-only credential.
 */
function readVendorCredential(): string {
  const credential = process.env["VENDOR_API_KEY"];
  if (credential === undefined || credential.length === 0) {
    throw new Error("VENDOR_API_KEY must be set in the server environment.");
  }
  return credential;
}

/**
 * Creates the server client after the credential is available.
 *
 * The credential source closes over the server value. Callers do not pass it
 * in from a browser.
 *
 * @returns A Node client that can authorize with the server credential.
 */
export function createServerClient() {
  const credentialSource: CredentialSource = {
    getCredential: () => Promise.resolve(new SecretValue(readVendorCredential())),
  };
  return createDefaultClient({
    adapter: createOpenAIChatCompletionAdapter(),
    components: {
      authorizationHandlers: [new BearerAuthorizationHandler()],
    },
    clientConfiguration: {
      defaultTarget: providerTarget,
      defaultServiceAccess: {
        endpoint: { kind: "absolute", value: "https://provider.example.test/v1" },
        authorization: { kind: bearerAuthorizationKind, credentialSource },
        headers: [],
        query: [],
        extensions: {},
      },
    },
  });
}

const server = createServer((_request, response) => {
  response.writeHead(200, { "content-type": "application/json" });
  response.end('{"ok":true}');
});

server.listen(8788, "127.0.0.1", () => {
  createServerClient();
});
