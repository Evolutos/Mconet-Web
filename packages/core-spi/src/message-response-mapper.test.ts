// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it, vi } from "vitest";

import type { Artifact, MessageDocument, UriArtifactSource } from "@evolutos/mconet-core-domain";

import type { ErasedRuntimeValue } from "./erased-runtime-value.js";
import type { MessageMappingResult } from "./message-mapping-result.js";
import type { MessageResponseMapper } from "./message-response-mapper.js";
import type { RuntimeComponent } from "./runtime-component.js";

it("defines the exact synchronous response fragment mapping boundary", () => {
  // RuntimeComponent supplies descriptor metadata; the mapper adds only the
  // directionally named decoded-fragment-to-message-result operation.
  expectTypeOf<MessageResponseMapper>().toMatchTypeOf<RuntimeComponent>();
  expectTypeOf<MessageResponseMapper["mapResponse"]>().toEqualTypeOf<
    (fragment: ErasedRuntimeValue) => MessageMappingResult
  >();
});

it("preserves fragment input and atomic document plus Artifact Catalog output", () => {
  const nativeFragment = { choices: [{ message: { content: "hello" } }] };
  const fragment: ErasedRuntimeValue = {
    typeId: "protocol.example.message-response",
    schemaId: "schema://protocol.example/message-response/1",
    value: nativeFragment,
  };
  const document: MessageDocument = {
    version: "1.0",
    purpose: "output",
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
  const source: UriArtifactSource = {
    kind: "artifact.source.uri",
    uri: { kind: "absolute", value: "https://assets.example.test/image.png" },
  };
  const artifact: Artifact = {
    id: "artifact-1",
    kind: { id: "artifact.image", extensions: {} },
    source,
    metadata: {},
    extensions: {},
  };
  const expected: MessageMappingResult = {
    document,
    artifacts: { artifacts: [artifact] },
  };
  const mapResponse = vi.fn((): MessageMappingResult => {
    // Return the configured atomic result directly; concrete protocol parsing
    // belongs to the implementation rather than the structural SPI test.
    return expected;
  });
  const mapper: MessageResponseMapper = {
    descriptor: {
      name: "fixture-message-response-mapper",
      version: "1.0.0",
      capabilities: new Set(),
      source: "plugin",
    },
    mapResponse,
  };

  // The boundary retains the decoded fragment and returns one result object so
  // callers cannot observe a document detached from its local Artifact Catalog.
  const actual = mapper.mapResponse(fragment);
  expect(actual).toBe(expected);
  expect(actual.document).toBe(document);
  expect(actual.artifacts.artifacts[0]).toBe(artifact);
  expect(mapResponse).toHaveBeenCalledOnce();
  expect(mapResponse).toHaveBeenCalledWith(fragment);
  expect(mapResponse.mock.calls[0]?.[0]).toBe(fragment);
});

it("keeps an explicit empty Artifact Catalog in a successful result", () => {
  const expected: MessageMappingResult = {
    document: {
      version: "1.0",
      purpose: "output",
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
    },
    artifacts: { artifacts: [] },
  };
  const mapper: MessageResponseMapper = {
    descriptor: {
      name: "text-message-response-mapper",
      version: "1.0.0",
      capabilities: new Set(),
      source: "builtin",
    },
    mapResponse() {
      // Text-only responses still return a complete Catalog instead of null or
      // omission, preserving one unambiguous result-local Artifact scope.
      return expected;
    },
  };

  expect(mapper.mapResponse({ typeId: "protocol.example.message-response", value: {} })).toBe(
    expected,
  );
  expect(expected.artifacts).toEqual({ artifacts: [] });
});

it("preserves response mapping failures without partial domain publication", () => {
  const failure = new Error("invalid protocol message response");
  const mapper: MessageResponseMapper = {
    descriptor: {
      name: "strict-message-response-mapper",
      version: "1.0.0",
      capabilities: new Set(),
      source: "plugin",
    },
    mapResponse() {
      // Invalid fragments fail atomically; the SPI never publishes a document
      // while discarding referenced Artifacts or inventing an empty Catalog.
      throw failure;
    },
  };

  expect(() =>
    mapper.mapResponse({ typeId: "protocol.example.message-response", value: null }),
  ).toThrow(failure);
});

it("does not expose decoder transport authorization task or catalog merge behavior", () => {
  // Byte decoding happens before mapping, while Runtime owns task result assembly
  // and safe merging of result-local Artifact identity scopes.
  expectTypeOf<MessageResponseMapper>().not.toHaveProperty("decode");
  expectTypeOf<MessageResponseMapper>().not.toHaveProperty("send");
  expectTypeOf<MessageResponseMapper>().not.toHaveProperty("apply");
  expectTypeOf<MessageResponseMapper>().not.toHaveProperty("parseResponse");
  expectTypeOf<MessageResponseMapper>().not.toHaveProperty("assembleOutput");
  expectTypeOf<MessageResponseMapper>().not.toHaveProperty("mergeArtifacts");
  expectTypeOf<MessageResponseMapper>().not.toHaveProperty("resolve");
});
