// Copyright © 2026 Mcont.

import type { TransportRequest } from "@evolutos/mconet-core-spi";
import { expect, it } from "vitest";

import { startNodeFetchTestServer } from "./node-fetch-test-server.js";
import { NodeFetchTransport } from "./node-fetch-transport.js";

/** Response header value that must not appear on a read error. */
const secret = "TEST_ONLY_DO_NOT_USE";

it("normalizes a truncated Node response stream as a body read failure", async () => {
  const server = await startNodeFetchTestServer((request, response) => {
    request.resume();
    response.writeHead(200, {
      "content-type": "application/octet-stream",
      "content-length": "4",
      "x-secret": secret,
    });
    response.write(Uint8Array.from([1, 2]));
    setImmediate(() => {
      request.socket?.destroy();
    });
  });
  const transport = new NodeFetchTransport();

  try {
    const error = await transport
      .send(requestFor(server.origin), {
        signal: new AbortController().signal,
        maxResponseBodyBytes: 16,
      })
      .then(
        () => undefined,
        (caught: unknown) => caught,
      );

    expect(error).toMatchObject({
      message: "Fetch could not read the response body.",
      category: "network",
      code: "response_body_read_failed",
    });
    expect(String(error)).not.toContain(secret);
  } finally {
    await server.close();
  }
});

/**
 * Builds a request whose response is closed before the declared body ends.
 *
 * @param origin Loopback origin that truncates the response.
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
