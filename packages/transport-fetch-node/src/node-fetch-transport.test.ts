// Copyright © 2026 Mcont.

import type { TransportRequest } from "@evolutos/mconet-core-spi";
import { expect, it } from "vitest";

import type { NodeFetch, NodeFetchDispatcher } from "./node-fetch-transport-options.js";
import { NodeFetchTransport } from "./node-fetch-transport.js";

/** Query text that must not enter a transport error. */
const secretValue = "node-query-secret";

const request: TransportRequest = {
  method: "POST",
  url: { kind: "absolute", value: "https://example.test/v1" },
  headers: [{ name: "content-type", value: "text/plain" }],
  query: [],
  body: { kind: "bytes", bytes: new Uint8Array([1, 2]) },
};

it("runs on Node 20 or newer and binds the global fetch function", () => {
  const [major = Number.NaN] = process.versions.node.split(".").map(Number);

  expect(major).toBeGreaterThanOrEqual(20);
  expect(typeof globalThis.fetch).toBe("function");
  expect(new NodeFetchTransport().boundTo(globalThis.fetch)).toBe(true);
});

it("sends through the bound fetch function without closing a dispatcher", async () => {
  let fetchCalls = 0;
  let closeCalls = 0;
  const dispatcher: NodeFetchDispatcher = {
    close() {
      closeCalls += 1;
    },
  };
  const fetchImplementation: NodeFetch = (_input, init) => {
    fetchCalls += 1;
    expect(init).toMatchObject({
      method: "POST",
      credentials: "omit",
      redirect: "error",
      referrerPolicy: "no-referrer",
    });
    expect(new Uint8Array(init?.body as ArrayBuffer)).toEqual(new Uint8Array([1, 2]));
    expect(Reflect.get(init ?? {}, "dispatcher")).toBe(dispatcher);
    return Promise.resolve(
      new Response(new Uint8Array([3, 4]), {
        status: 200,
        headers: { "content-type": "text/plain" },
      }),
    );
  };
  const transport = new NodeFetchTransport({
    fetch: fetchImplementation,
    dispatcher,
    dispatcherOwnership: "sdk",
  });

  await expect(
    transport.send(request, { signal: new AbortController().signal, maxResponseBodyBytes: 8 }),
  ).resolves.toMatchObject({
    metadata: { outcome: "success", statusCode: 200 },
    body: new Uint8Array([3, 4]),
  });
  expect(fetchCalls).toBe(1);
  expect(closeCalls).toBe(0);
  expect(transport.boundTo(fetchImplementation)).toBe(true);
  expect(transport.boundTo(globalThis.fetch)).toBe(false);
});

it("sends duplicate query names in declaration order", async () => {
  let seenUrl = "";
  const fetchImplementation: NodeFetch = (input) => {
    seenUrl = String(input);
    return Promise.resolve(new Response(null, { status: 200 }));
  };
  const transport = new NodeFetchTransport({ fetch: fetchImplementation });

  await transport.send(
    {
      ...request,
      query: [
        { name: "tag", value: "first" },
        { name: "tag", value: secretValue },
      ],
    },
    { signal: new AbortController().signal, maxResponseBodyBytes: 8 },
  );

  expect(seenUrl).toBe(`https://example.test/v1?tag=first&tag=${secretValue}`);
});
