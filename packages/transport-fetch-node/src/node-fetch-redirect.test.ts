// Copyright © 2026 Mcont.

import type { TransportRequest } from "@evolutos/mconet-core-spi";
import { expect, it } from "vitest";

import { startNodeFetchTestServer } from "./node-fetch-test-server.js";
import { NodeFetchTransport } from "./node-fetch-transport.js";

/** Authorization value that must not reach another origin or an error. */
const secret = "TEST_ONLY_DO_NOT_USE";

it("does not send authorization to another origin when Fetch is redirected", async () => {
  let redirectedRequests = 0;
  const redirected = await startNodeFetchTestServer((request, response) => {
    redirectedRequests += 1;
    request.resume();
    response.writeHead(200);
    response.end();
  });
  let sourceAuthorization: string | undefined;
  const source = await startNodeFetchTestServer((request, response) => {
    sourceAuthorization = request.headers.authorization;
    request.resume();
    response.writeHead(302, { location: `${redirected.origin}/v1` });
    response.end();
  });
  const transport = new NodeFetchTransport();

  try {
    const error = await transport
      .send(requestFor(source.origin), {
        signal: new AbortController().signal,
        maxResponseBodyBytes: 16,
      })
      .then(
        () => undefined,
        (caught: unknown) => caught,
      );

    expect(sourceAuthorization).toBe(`Bearer ${secret}`);
    expect(redirectedRequests).toBe(0);
    expect(error).toMatchObject({ code: "network_error" });
    expect(String(error)).not.toContain(secret);
  } finally {
    await source.close();
    await redirected.close();
  }
});

/**
 * Builds a request that carries authorization toward the source origin.
 *
 * @param origin Loopback origin that answers with a redirect.
 * @returns Encoded transport request.
 */
function requestFor(origin: string): TransportRequest {
  return {
    method: "POST",
    url: { kind: "absolute", value: `${origin}/v1` },
    headers: [{ name: "authorization", value: `Bearer ${secret}` }],
    query: [],
    body: { kind: "bytes", bytes: Uint8Array.from([1]) },
  };
}
