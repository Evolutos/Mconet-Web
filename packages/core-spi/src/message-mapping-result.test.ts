// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type {
  Artifact,
  ArtifactCatalog,
  InlineArtifactSource,
  MessageDocument,
} from "@evolutos/mconet-core-domain";

import type { MessageMappingResult } from "./message-mapping-result.js";

it("defines only the mapped document and its Artifact Catalog", () => {
  // Exact equality prevents decoded bytes, transport metadata, task output,
  // diagnostics, or Artifact-resolution state from entering this result value.
  expectTypeOf<MessageMappingResult>().toEqualTypeOf<{
    readonly document: MessageDocument;
    readonly artifacts: ArtifactCatalog;
  }>();
});

it("returns the mapped document and Artifact Catalog as one atomic value", () => {
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
  const source: InlineArtifactSource = {
    kind: "artifact.source.inline",
    bytes: new Uint8Array([1, 2, 3]),
  };
  const artifact: Artifact = {
    id: "artifact-1",
    kind: {
      id: "artifact.image",
      extensions: {},
    },
    source,
    metadata: {},
    extensions: {},
  };
  const artifacts: ArtifactCatalog = { artifacts: [artifact] };
  const result: MessageMappingResult = { document, artifacts };

  // Mapping records the exact domain values without cloning, resolving, or
  // merging the result-local Artifact Catalog into another identity scope.
  expect(result.document).toBe(document);
  expect(result.artifacts).toBe(artifacts);
  expect(result.artifacts.artifacts[0]).toBe(artifact);
});

it("keeps an explicit empty Artifact Catalog beside the document", () => {
  const result: MessageMappingResult = {
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

  // An empty Catalog remains present instead of using null or omission, which
  // gives every mapped document one unambiguous local Artifact identity scope.
  expect(result.artifacts).toEqual({ artifacts: [] });
});

it("prevents either half of the mapping result from being replaced", () => {
  const proveReadonly = (
    result: MessageMappingResult,
    document: MessageDocument,
    artifacts: ArtifactCatalog,
  ): void => {
    // This helper remains compile-only; both assignments must be rejected so a
    // consumer cannot detach references from their accompanying Catalog.
    // @ts-expect-error The mapped document cannot be replaced.
    result.document = document;
    // @ts-expect-error The result-local Artifact Catalog cannot be replaced.
    result.artifacts = artifacts;
  };

  expectTypeOf(proveReadonly).toBeFunction();
});
