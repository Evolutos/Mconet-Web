// Copyright © 2026 Mcont.

import type { TransportRequest } from "@evolutos/mconet-core-spi";
import { expect, it } from "vitest";

import { startNodeFetchTestServer } from "./node-fetch-test-server.js";
import { NodeFetchTransport } from "./node-fetch-transport.js";

/** Response header value that must not appear on a limit error. */
const secret = "node-body-limit-secret";

it("cancels a Node response read as soon as the body crosses its limit", async () => {
  let trailingChunkWritten = false;
  const server = await startNodeFetchTestServer((request, response) => {
    request.resume();
    response.writeHead(200, {
      "content-type": "application/octet-stream",
      "x-secret": secret,
    });
    response.write(Uint8Array.from([1, 2, 3, 4, 5]));
    setTimeout(() => {
      if (response.destroyed || response.writableEnded) {
        return;
      }

      trailingChunkWritten = true;
      response.end(Uint8Array.from([6]));
    }, 200);
  });
  const transport = new NodeFetchTransport();

  try {
    const error = await transport
      .send(requestFor(server.origin), {
        signal: new AbortController().signal,
        maxResponseBodyBytes: 4,
      })
      .then(
        () => undefined,
        (caught: unknown) => caught,
      );

    expect(error).toMatchObject({
      message: "Response body exceeds its byte limit.",
      category: "invalid_request",
      code: "response_body_too_large",
    });
    expect(String(error)).not.toContain(secret);
    await new Promise((resolve) => {
      setTimeout(resolve, 250);
    });
    expect(trailingChunkWritten).toBe(false);
  } finally {
    await server.close();
  }
});

/**
 * Builds a request whose response is larger than the caller limit.
 *
 * @param origin Loopback origin that streams past the limit.
 * @returns Encoded transport request.
 */
function requestFor(origin: string): TransportRequest {
  return {
    method: "POST",
    url: { kind: "absolute", value: `${origin}/v1` },
    headers: [],
    query: [],
    body: { kind: "bytes", bytes: Uint8Array.from([1]) },
  };
}
