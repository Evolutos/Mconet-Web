// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it, vi } from "vitest";

import type { MessageDocument } from "@evolutos/mconet-core-domain";
import type { ErasedRuntimeValue, MessageRequestMapper } from "@evolutos/mconet-core-spi";

import { StubMessageRequestMapper } from "./stub-message-request-mapper.js";

/** Stable component metadata shared by mapper stub fixtures. */
const descriptor: MessageRequestMapper["descriptor"] = {
  name: "stub-message-request-mapper",
  version: "1.0.0",
  capabilities: new Set(),
  source: "application",
};

/** First complete message document used to prove input identity. */
const firstDocument: MessageDocument = {
  version: "1.0",
  purpose: "input",
  root: {
    id: "first-root",
    kind: "message.root",
    composition: "container",
    children: [],
    relations: [],
    metadata: {},
    extensions: {},
  },
  metadata: {},
  extensions: {},
};

/** Second distinct document used to prove ordered recording. */
const secondDocument: MessageDocument = {
  version: "1.0",
  purpose: "input",
  root: {
    id: "second-root",
    kind: "message.root",
    composition: "container",
    children: [],
    relations: [],
    metadata: {},
    extensions: {},
  },
  metadata: {},
  extensions: {},
};

/** Configured protocol-native result preserved by identity. */
const mappedValue: ErasedRuntimeValue = {
  typeId: "protocol.example.message-request",
  schemaId: "schema://protocol.example/message-request/1",
  value: { messages: [] },
};

it("records the original input before returning the configured result", () => {
  const mapRequest = vi.fn(() => mappedValue);
  const stub = new StubMessageRequestMapper({ descriptor, mapRequest });

  // The stub begins with no implicit calls, delegates once, and returns the exact
  // integration-owned erased value without cloning its native payload.
  expect(stub.snapshotInputs()).toEqual([]);
  expect(stub.descriptor).toBe(descriptor);
  expect(stub.mapRequest(firstDocument)).toBe(mappedValue);
  expect(mapRequest).toHaveBeenCalledExactlyOnceWith(firstDocument);
  expect(stub.snapshotInputs()).toEqual([firstDocument]);
  expect(stub.snapshotInputs()[0]).toBe(firstDocument);
});

it("preserves invocation order and repeated input identities", () => {
  const stub = new StubMessageRequestMapper({
    descriptor,
    mapRequest: () => mappedValue,
  });

  stub.mapRequest(firstDocument);
  stub.mapRequest(secondDocument);
  stub.mapRequest(firstDocument);

  // An array rather than a Set or count preserves cross-call order and repeated
  // use of the same document instance.
  expect(stub.snapshotInputs()).toEqual([firstDocument, secondDocument, firstDocument]);
  expect(stub.snapshotInputs()[0]).toBe(firstDocument);
  expect(stub.snapshotInputs()[1]).toBe(secondDocument);
  expect(stub.snapshotInputs()[2]).toBe(firstDocument);
});

it("returns frozen snapshots detached from later mapping attempts", () => {
  const stub = new StubMessageRequestMapper({
    descriptor,
    mapRequest: () => mappedValue,
  });
  stub.mapRequest(firstDocument);
  const firstSnapshot = stub.snapshotInputs();

  stub.mapRequest(secondDocument);
  const secondSnapshot = stub.snapshotInputs();

  // Freezing protects the array boundary without cloning caller-owned documents;
  // later attempts cannot change an earlier assertion snapshot.
  expect(firstSnapshot).toEqual([firstDocument]);
  expect(secondSnapshot).toEqual([firstDocument, secondDocument]);
  expect(firstSnapshot).not.toBe(secondSnapshot);
  expect(Object.isFrozen(firstSnapshot)).toBe(true);
  expect(Reflect.set(firstSnapshot, 0, secondDocument)).toBe(false);
  expect(stub.snapshotInputs()).toEqual([firstDocument, secondDocument]);
});

it("records a failed mapping attempt and propagates the same failure", () => {
  const failure = new Error("message mapping failed");
  const stub = new StubMessageRequestMapper({
    descriptor,
    mapRequest: () => {
      throw failure;
    },
  });

  // Recording occurs at boundary entry, before the configured handler can fail;
  // the stub does not substitute a partial value or wrap the error.
  expect(() => stub.mapRequest(firstDocument)).toThrow(failure);
  expect(stub.snapshotInputs()).toEqual([firstDocument]);
  expect(stub.snapshotInputs()[0]).toBe(firstDocument);
});

it("captures configuration and exposes only mapper plus input snapshot behavior", () => {
  const originalHandler = vi.fn(() => mappedValue);
  const replacementValue: ErasedRuntimeValue = {
    typeId: "protocol.example.replacement",
    value: null,
  };
  const configuration = { descriptor, mapRequest: originalHandler };
  const stub = new StubMessageRequestMapper(configuration);
  configuration.mapRequest = () => replacementValue;

  // Construction snapshots handler identity; public type remains the mapper SPI
  // plus one read-only testing observation method and no reset/output history.
  expect(stub.mapRequest(firstDocument)).toBe(mappedValue);
  expect(originalHandler).toHaveBeenCalledExactlyOnceWith(firstDocument);
  expectTypeOf<StubMessageRequestMapper>().toMatchTypeOf<MessageRequestMapper>();
  expectTypeOf<StubMessageRequestMapper["mapRequest"]>().toEqualTypeOf<
    MessageRequestMapper["mapRequest"]
  >();
  expectTypeOf<StubMessageRequestMapper["snapshotInputs"]>().toEqualTypeOf<
    () => readonly MessageDocument[]
  >();
  expectTypeOf<StubMessageRequestMapper>().not.toHaveProperty("reset");
  expectTypeOf<StubMessageRequestMapper>().not.toHaveProperty("outputs");
  expectTypeOf<StubMessageRequestMapper>().not.toHaveProperty("encode");
});
