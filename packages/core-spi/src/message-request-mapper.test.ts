// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it, vi } from "vitest";

import type { MessageDocument } from "@evolutos/mconet-core-domain";

import type { ErasedRuntimeValue } from "./erased-runtime-value.js";
import type { MessageRequestMapper } from "./message-request-mapper.js";
import type { RuntimeComponent } from "./runtime-component.js";

it("defines the exact synchronous message request mapping boundary", () => {
  // RuntimeComponent contributes descriptor metadata; the mapper adds only the
  // directionally named document-to-fragment operation.
  expectTypeOf<MessageRequestMapper>().toMatchTypeOf<RuntimeComponent>();
  expectTypeOf<MessageRequestMapper["mapRequest"]>().toEqualTypeOf<
    (document: MessageDocument) => ErasedRuntimeValue
  >();
});

it("forwards the complete document and preserves the native fragment identity", () => {
  const document: MessageDocument = {
    version: "1.0",
    purpose: "input",
    root: {
      id: "message-root",
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
  const nativeFragment = { messages: [] as unknown[] };
  const expected: ErasedRuntimeValue = {
    typeId: "protocol.example.message-request",
    schemaId: "schema://protocol.example/message-request/1",
    value: nativeFragment,
  };
  const mapRequest = vi.fn((): ErasedRuntimeValue => {
    // Return the configured native fragment unchanged. Concrete message mapping
    // logic belongs to the implementation rather than the structural SPI test.
    return expected;
  });
  const mapper: MessageRequestMapper = {
    descriptor: {
      name: "fixture-message-request-mapper",
      version: "1.0.0",
      capabilities: new Set(),
      source: "plugin",
    },
    mapRequest,
  };

  // Identity assertions prove the abstract boundary does not clone the message
  // tree, encode the fragment, or wrap its integration-owned native value.
  const actual = mapper.mapRequest(document);
  expect(actual).toBe(expected);
  expect(actual.value).toBe(nativeFragment);
  expect(mapRequest).toHaveBeenCalledOnce();
  expect(mapRequest).toHaveBeenCalledWith(document);
  expect(mapRequest.mock.calls[0]?.[0]).toBe(document);
});

it("preserves mapping failures without producing a partial fragment", () => {
  const failure = new Error("unsupported message content");
  const mapper: MessageRequestMapper = {
    descriptor: {
      name: "strict-message-request-mapper",
      version: "1.0.0",
      capabilities: new Set(),
      source: "builtin",
    },
    mapRequest() {
      // An implementation rejects unsupported message semantics synchronously;
      // the SPI does not catch, downgrade, or substitute a partial fragment.
      throw failure;
    },
  };
  const document: MessageDocument = {
    version: "1.0",
    purpose: "input",
    root: {
      id: "message-root",
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

  expect(() => mapper.mapRequest(document)).toThrow(failure);
});

it("does not expose codec transport authorization task or registry behavior", () => {
  // The task adapter composes mapped fragments; later pipeline components own
  // bytes, credentials, network I/O, and component resolution.
  expectTypeOf<MessageRequestMapper>().not.toHaveProperty("encode");
  expectTypeOf<MessageRequestMapper>().not.toHaveProperty("send");
  expectTypeOf<MessageRequestMapper>().not.toHaveProperty("apply");
  expectTypeOf<MessageRequestMapper>().not.toHaveProperty("getCredential");
  expectTypeOf<MessageRequestMapper>().not.toHaveProperty("preparePlan");
  expectTypeOf<MessageRequestMapper>().not.toHaveProperty("register");
  expectTypeOf<MessageRequestMapper>().not.toHaveProperty("resolve");
});
