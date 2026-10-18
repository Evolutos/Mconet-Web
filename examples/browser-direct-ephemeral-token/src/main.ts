// Copyright © 2026 Mcont.

import { bearerAuthorizationKind } from "@evolutos/mconet-auth-basic";
import { createOpenAICompatibleClient, interactWithText } from "@evolutos/mconet-client";
import { SecretValue } from "@evolutos/mconet-core-domain";
import type { CredentialSource } from "@evolutos/mconet-core-spi";

/**
 * Direct browser call premises.
 *
 * Use this path only when the provider enables CORS for this page's origin,
 * including Access-Control-Allow-Origin and Access-Control-Allow-Headers for
 * authorization. The credential must be a short-lived, revocable, user-scoped
 * token supplied at the call. A long-lived vendor key does not belong in this
 * file, the page, or browser storage.
 */
const providerEndpoint = "https://provider.example.test/v1";

/** Target for the direct chat-completions call. */
const providerTarget = {
  serviceId: "provider.example",
  protocolId: "openai.chat.completions",
  model: { name: "vendor-model", metadata: {}, extensions: {} },
  extensions: {},
} as const;

/**
 * Builds a client that reads one ephemeral token through a credential source.
 *
 * The token is not stored on the module. The OpenAI-compatible factory
 * installs the chat codecs, the server-stream reader, and the Bearer handler.
 * The handler may reveal the token only for that call.
 *
 * @param ephemeralToken Short-lived token supplied by the page for one call.
 * @returns A client aimed at the CORS-enabled provider.
 */
export function createEphemeralTokenClient(ephemeralToken: string) {
  const credentialSource: CredentialSource = {
    getCredential: () => Promise.resolve(new SecretValue(ephemeralToken)),
  };
  return createOpenAICompatibleClient({
    target: providerTarget,
    serviceAccess: {
      endpoint: { kind: "absolute", value: providerEndpoint },
      authorization: { kind: bearerAuthorizationKind, credentialSource },
      headers: [],
      query: [],
      extensions: {},
    },
  });
}

const tokenInput = document.querySelector("#token");
const sendButton = document.querySelector("#send");
sendButton?.addEventListener("click", () => {
  const ephemeralToken = readToken(tokenInput);
  if (ephemeralToken === undefined || ephemeralToken.length === 0) {
    return;
  }
  const client = createEphemeralTokenClient(ephemeralToken);
  void interactWithText(client, {
    target: providerTarget,
    messages: [{ role: "user", text: "Hello" }],
  });
});

/**
 * Reads a token from the page input without treating any other element as text.
 *
 * @param element Element selected from the page.
 * @returns The current input text, when the element is an input.
 */
function readToken(element: Element | null): string | undefined {
  if (element === null || !("value" in element) || typeof element.value !== "string") {
    return undefined;
  }
  return element.value;
}
