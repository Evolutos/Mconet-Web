// Copyright © 2026 Mcont.

import { createOpenAICompatibleClient, interactWithText } from "@evolutos/mconet-client";

/**
 * Same-origin BFF path. The browser never names a vendor host or credential.
 * The application session, if any, is the browser's own cookie, not a vendor key.
 */
const bffEndpoint = new URL("/bff/chat/completions", globalThis.location.origin).href;

/** Target stored by the client. Protocol selection stays explicit. */
const bffTarget = {
  serviceId: "application.bff",
  protocolId: "openai.chat.completions",
  model: { name: "vendor-model", metadata: {}, extensions: {} },
  extensions: {},
} as const;

/**
 * Browser client aimed at the application BFF.
 *
 * Authorization is none because this page does not possess the vendor
 * credential. The BFF adds that credential on the server.
 */
const bffClient = createOpenAICompatibleClient({
  target: bffTarget,
  serviceAccess: {
    endpoint: { kind: "absolute", value: bffEndpoint },
    authorization: { kind: "authorization.none" },
    headers: [],
    query: [],
    extensions: {},
  },
});

const sendButton = document.querySelector("#send");
sendButton?.addEventListener("click", () => {
  void interactWithText(bffClient, {
    target: bffTarget,
    messages: [{ role: "user", text: "Hello" }],
  });
});
