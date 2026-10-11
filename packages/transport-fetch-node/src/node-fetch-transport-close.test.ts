// Copyright © 2026 Mcont.

import { expect, it } from "vitest";

import type { NodeFetch, NodeFetchDispatcher } from "./node-fetch-transport-options.js";
import { NodeFetchTransport } from "./node-fetch-transport.js";

const fetchImplementation: NodeFetch = () => Promise.reject(new Error("fetch called"));

it("does not release an application-owned dispatcher on close", async () => {
  let closeCalls = 0;
  const dispatcher: NodeFetchDispatcher = {
    close() {
      closeCalls += 1;
      throw new Error("application dispatcher closed");
    },
  };
  const transport = new NodeFetchTransport({
    fetch: fetchImplementation,
    dispatcher,
    dispatcherOwnership: "application",
  });

  await transport.close();
  await transport.close();

  expect(closeCalls).toBe(0);
});

it("does not release a dispatcher when ownership is omitted", async () => {
  let closeCalls = 0;
  const dispatcher: NodeFetchDispatcher = {
    close() {
      closeCalls += 1;
    },
  };
  const transport = new NodeFetchTransport({
    fetch: fetchImplementation,
    dispatcher,
  });

  await transport.close();

  expect(closeCalls).toBe(0);
});

it("releases an SDK-owned dispatcher exactly once", async () => {
  let closeCalls = 0;
  let finished = false;
  const dispatcher: NodeFetchDispatcher = {
    close() {
      closeCalls += 1;
      return Promise.resolve().then(() => {
        finished = true;
      });
    },
  };
  const transport = new NodeFetchTransport({
    fetch: fetchImplementation,
    dispatcher,
    dispatcherOwnership: "sdk",
  });

  await transport.close();
  await transport.close();

  expect(closeCalls).toBe(1);
  expect(finished).toBe(true);
});

it("does not release an SDK dispatcher twice when closes overlap", async () => {
  let closeCalls = 0;
  let release = (): void => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const dispatcher: NodeFetchDispatcher = {
    close() {
      closeCalls += 1;
      return gate;
    },
  };
  const transport = new NodeFetchTransport({
    fetch: fetchImplementation,
    dispatcher,
    dispatcherOwnership: "sdk",
  });
  const first = transport.close();
  const second = transport.close();

  expect(closeCalls).toBe(1);
  release();
  await first;
  await second;
  expect(closeCalls).toBe(1);
});

it("does not release an SDK dispatcher again after close fails", async () => {
  let closeCalls = 0;
  const dispatcher: NodeFetchDispatcher = {
    close() {
      closeCalls += 1;
      return Promise.reject(new Error("close failed"));
    },
  };
  const transport = new NodeFetchTransport({
    fetch: fetchImplementation,
    dispatcher,
    dispatcherOwnership: "sdk",
  });

  await expect(transport.close()).rejects.toThrow("close failed");
  await transport.close();
  expect(closeCalls).toBe(1);
});
