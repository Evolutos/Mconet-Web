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
