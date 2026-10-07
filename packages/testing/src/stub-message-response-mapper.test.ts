// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type { Artifact, MessageDocument, UriArtifactSource } from "@evolutos/mconet-core-domain";
import type {
  ErasedRuntimeValue,
  MessageMappingResult,
  MessageResponseMapper,
} from "@evolutos/mconet-core-spi";

import { StubMessageResponseMapper } from "./stub-message-response-mapper.js";

/** Stable component metadata shared by response mapper stub fixtures. */
const descriptor: MessageResponseMapper["descriptor"] = {
  name: "stub-message-response-mapper",
  version: "1.0.0",
  capabilities: new Set(),
  source: "application",
};

/** Complete output document retained as part of the atomic mapping result. */
const document: MessageDocument = {
  version: "1.0",
  purpose: "output",
  root: {
    id: "response-root",
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

/** URI source used to prove nested Artifact identity preservation. */
const artifactSource: UriArtifactSource = {
  kind: "artifact.source.uri",
  uri: { kind: "absolute", value: "https://assets.example.test/response.png" },
};

/** Result-local Artifact returned together with the output document. */
const artifact: Artifact = {
  id: "response-artifact",
  kind: { id: "artifact.image", extensions: {} },
  source: artifactSource,
  metadata: {},
  extensions: {},
};

/** Deterministic atomic result returned by the stub. */
const result: MessageMappingResult = {
  document,
  artifacts: { artifacts: [artifact] },
};

/** First decoded fragment used to prove that no protocol parsing occurs. */
const firstFragment: ErasedRuntimeValue = {
  typeId: "protocol.example.message-response",
  schemaId: "schema://protocol.example/message-response/1",
  value: { choices: [{ message: { content: "first" } }] },
};

/** Structurally different fragment used to prove deterministic output. */
const secondFragment: ErasedRuntimeValue = {
  typeId: "protocol.example.alternate-response",
  value: null,
};

it("returns the exact configured atomic mapping result", () => {
  const stub = new StubMessageResponseMapper({ descriptor, result });

  const actual = stub.mapResponse(firstFragment);

  // The test double keeps descriptor, result, document, Catalog, and Artifact
  // identities intact rather than cloning or reconstructing domain values.
  expect(stub.descriptor).toBe(descriptor);
  expect(actual).toBe(result);
  expect(actual.document).toBe(document);
  expect(actual.artifacts).toBe(result.artifacts);
  expect(actual.artifacts.artifacts[0]).toBe(artifact);
});

it("returns one deterministic result for structurally different fragments", () => {
  const stub = new StubMessageResponseMapper({ descriptor, result });

  const first = stub.mapResponse(firstFragment);
  const second = stub.mapResponse(secondFragment);

  // Fragment content and identity do not influence a fixed-result stub, making
  // repeated higher-level tests independent of protocol parsing behavior.
  expect(first).toBe(result);
  expect(second).toBe(result);
  expect(second).toBe(first);
});

it("captures the configured result reference at construction", () => {
  const replacement: MessageMappingResult = {
    document: { ...document, purpose: "transcript" },
    artifacts: { artifacts: [] },
  };
  const configuration = { descriptor, result };
  const stub = new StubMessageResponseMapper(configuration);
  configuration.result = replacement;

  // Reassigning a mutable JavaScript configuration object cannot alter an
  // already-created stub; deterministic behavior remains fixed per instance.
  expect(stub.mapResponse(firstFragment)).toBe(result);
  expect(stub.mapResponse(firstFragment)).not.toBe(replacement);
});

it("implements only the response mapper boundary", () => {
  // Compile-time checks keep the public method identical to the SPI while
  // excluding input history, parsing, decoding, and mutable reset behavior.
  expectTypeOf<StubMessageResponseMapper>().toMatchTypeOf<MessageResponseMapper>();
  expectTypeOf<StubMessageResponseMapper["mapResponse"]>().toEqualTypeOf<
    MessageResponseMapper["mapResponse"]
  >();
  expectTypeOf<StubMessageResponseMapper>().not.toHaveProperty("snapshotInputs");
  expectTypeOf<StubMessageResponseMapper>().not.toHaveProperty("parseResponse");
  expectTypeOf<StubMessageResponseMapper>().not.toHaveProperty("decode");
  expectTypeOf<StubMessageResponseMapper>().not.toHaveProperty("reset");
});
