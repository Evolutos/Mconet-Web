// Copyright © 2026 Mcont.

import type { TransportRequest } from "@evolutos/mconet-core-spi";
import { expect, it } from "vitest";

import { BrowserFetchTransport } from "./browser-fetch-transport.js";
import type { BrowserFetch } from "./browser-fetch-transport-options.js";

/** Query or abort text that must not enter a transport error. */
const secretValue = "send-secret-value";

const request: TransportRequest = {
  method: "POST",
  url: { kind: "absolute", value: "https://example.test/v1" },
  headers: [{ name: "content-type", value: "text/plain" }],
  query: [],
  body: { kind: "bytes", bytes: new Uint8Array([1, 2]) },
};

it("sends with omit credentials, an error redirect, and no referrer", async () => {
  let calls = 0;
  const fetchImplementation: BrowserFetch = (_input, init) => {
    calls += 1;
    expect(init).toMatchObject({
      method: "POST",
      credentials: "omit",
      redirect: "error",
      referrerPolicy: "no-referrer",
    });
    expect(new Uint8Array(init?.body as ArrayBuffer)).toEqual(new Uint8Array([1, 2]));
    return Promise.resolve(
      new Response(new Uint8Array([3, 4]), {
        status: 200,
        headers: { "content-type": "text/plain" },
      }),
    );
  };
  const transport = new BrowserFetchTransport({ fetch: fetchImplementation });

  await expect(
    transport.send(request, { signal: new AbortController().signal, maxResponseBodyBytes: 8 }),
  ).resolves.toMatchObject({
    metadata: {
      outcome: "success",
      statusCode: 200,
      headers: [{ name: "content-type", value: "text/plain" }],
    },
    body: new Uint8Array([3, 4]),
  });
  expect(calls).toBe(1);
});

it("preserves a response that exceeds the caller byte limit", async () => {
  const fetchImplementation: BrowserFetch = () =>
    Promise.resolve(new Response(new Uint8Array([1, 2, 3, 4, 5])));
  const transport = new BrowserFetchTransport({ fetch: fetchImplementation });

  await expect(
    transport.send(request, { signal: new AbortController().signal, maxResponseBodyBytes: 4 }),
  ).rejects.toMatchObject({
    code: "response_body_too_large",
    phase: "transport",
  });
});

it("rejects a forbidden header before calling fetch", async () => {
  let calls = 0;
  const fetchImplementation: BrowserFetch = () => {
    calls += 1;
    return Promise.reject(new Error("fetch called"));
  };
  const transport = new BrowserFetchTransport({ fetch: fetchImplementation });
  const context = { signal: new AbortController().signal, maxResponseBodyBytes: 8 };

  await expect(
    transport.send(
      {
        ...request,
        headers: [{ name: "cookie", value: secretValue }],
      },
      context,
    ),
  ).rejects.toMatchObject({ code: "forbidden_request_header" });
  expect(calls).toBe(0);
});

it("sends duplicate query names in declaration order", async () => {
  let seenUrl = "";
  const fetchImplementation: BrowserFetch = (input) => {
    seenUrl = String(input);
    return Promise.resolve(new Response(null, { status: 200 }));
  };
  const transport = new BrowserFetchTransport({ fetch: fetchImplementation });

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

it("maps an aborted exchange to cancellation without the abort reason", async () => {
  const controller = new AbortController();
  const fetchImplementation: BrowserFetch = (_input, init) =>
    new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => {
        reject(init.signal?.reason);
      });
    });
  const transport = new BrowserFetchTransport({ fetch: fetchImplementation });
  const pending = transport.send(request, {
    signal: controller.signal,
    maxResponseBodyBytes: 8,
  });

  controller.abort(new Error(secretValue));

  await expect(pending).rejects.toMatchObject({
    category: "cancelled",
    code: "cancelled",
    phase: "transport",
  });
  await expect(pending).rejects.not.toSatisfy((error: unknown) => {
    return String(error).includes(secretValue);
  });
});
