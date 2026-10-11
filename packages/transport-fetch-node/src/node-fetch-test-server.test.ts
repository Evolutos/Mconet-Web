// Copyright © 2026 Mcont.

import type { TransportRequest } from "@evolutos/mconet-core-spi";
import { expect, it } from "vitest";

import { startNodeFetchTestServer } from "./node-fetch-test-server.js";
import { NodeFetchTransport } from "./node-fetch-transport.js";

it("lets a test choose the status and body returned to Node fetch", async () => {
  const responses = [
    { status: 200, body: Uint8Array.from([1, 2]) },
    { status: 503, body: Uint8Array.from([3]) },
  ];
  const seen: string[] = [];
  const server = await startNodeFetchTestServer((request, response) => {
    const next = responses.shift();
    seen.push(`${request.method ?? ""} ${request.url ?? ""}`);
    request.resume();
    response.writeHead(next?.status ?? 500, { "content-type": "application/octet-stream" });
    response.end(next?.body ?? new Uint8Array());
  });
  const transport = new NodeFetchTransport();

  try {
    const success = await transport.send(requestFor(server.origin), {
      signal: new AbortController().signal,
      maxResponseBodyBytes: 16,
    });
    const failure = await transport.send(requestFor(server.origin), {
      signal: new AbortController().signal,
      maxResponseBodyBytes: 16,
    });

    expect(success).toMatchObject({
      metadata: { outcome: "success", statusCode: 200 },
      body: Uint8Array.from([1, 2]),
    });
    expect(failure).toMatchObject({
      metadata: { outcome: "service_error", statusCode: 503 },
      body: Uint8Array.from([3]),
    });
    expect(seen).toEqual(["POST /v1", "POST /v1"]);
  } finally {
    await server.close();
  }

  await expect(fetch(server.origin)).rejects.toThrow();
});

/**
 * Builds a request aimed at the test server.
 *
 * @param origin Loopback origin from the test server.
 * @returns Encoded transport request.
 */
function requestFor(origin: string): TransportRequest {
  return {
    method: "POST",
    url: { kind: "absolute", value: `${origin}/v1` },
    headers: [],
    query: [],
    body: { kind: "bytes", bytes: Uint8Array.from([9]) },
  };
}
