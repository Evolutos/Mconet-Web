// Copyright © 2026 Mcont.

import type { TransportRequest } from "@evolutos/mconet-core-spi";
import { expect, it } from "vitest";

import { startNodeFetchTestServer } from "./node-fetch-test-server.js";
import { NodeFetchTransport } from "./node-fetch-transport.js";

/** Header value that must not appear on a timeout error. */
const secret = "TEST_ONLY_DO_NOT_USE";

it("normalizes an expired in-flight Node fetch deadline as timeout", async () => {
  let requestClosed = false;
  const server = await startNodeFetchTestServer((request, response) => {
    request.resume();
    const timer = setTimeout(() => {
      response.writeHead(200);
      response.end(Uint8Array.from([1]));
    }, 2_000);
    response.on("close", () => {
      clearTimeout(timer);
      requestClosed = true;
    });
  });
  const transport = new NodeFetchTransport();

  try {
    const error = await transport
      .send(requestFor(server.origin), {
        signal: new AbortController().signal,
        deadline: Date.now() + 100,
        maxResponseBodyBytes: 16,
      })
      .then(
        () => undefined,
        (caught: unknown) => caught,
      );

    expect(error).toMatchObject({
      message: "The Fetch deadline expired.",
      category: "timeout",
      code: "timeout",
    });
    expect(String(error)).not.toContain(secret);
    await expect.poll(() => requestClosed).toBe(true);
  } finally {
    await server.close();
  }
});

/**
 * Builds a request that stays open until the deadline aborts it.
 *
 * @param origin Loopback origin that does not answer.
 * @returns Encoded transport request.
 */
function requestFor(origin: string): TransportRequest {
  return {
    method: "POST",
    url: { kind: "absolute", value: `${origin}/v1` },
    headers: [{ name: "x-request-token", value: secret }],
    query: [],
    body: { kind: "bytes", bytes: Uint8Array.from([1]) },
  };
}
