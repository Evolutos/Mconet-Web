// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type { MediaType } from "@evolutos/mconet-core-domain";

import type { EncoderSelection } from "./encoder-selection.js";

it("defines only immutable encoder selection criteria", () => {
  // Exact equality prevents component IDs, instances, priorities, payloads, or
  // executable matching behavior from entering the protocol planning value.
  expectTypeOf<EncoderSelection>().toEqualTypeOf<{
    readonly mediaType?: MediaType;
    readonly schemaId?: string;
  }>();
});

it("preserves structured media type and schema requirements", () => {
  const mediaType: MediaType = {
    type: "application",
    subtype: "json",
    parameters: { charset: "utf-8" },
  };
  const selection: EncoderSelection = {
    mediaType,
    schemaId: "schema.protocol.request.v1",
  };

  // The criteria value neither reparses the media type nor normalizes the schema
  // identity; the protocol plan retains both caller-supplied requirements exactly.
  expect(selection.mediaType).toBe(mediaType);
  expect(selection.schemaId).toBe("schema.protocol.request.v1");
});

it("allows either criterion or both criteria to be omitted", () => {
  const mediaTypeOnly: EncoderSelection = {
    mediaType: { type: "application", subtype: "json", parameters: {} },
  };
  const schemaOnly: EncoderSelection = { schemaId: "schema.protocol.request.v2" };
  const unconstrained: EncoderSelection = {};

  // Absence remains explicit. The value does not invent a default wire format,
  // schema, encoder instance, or fallback selection policy.
  expect(Object.hasOwn(mediaTypeOnly, "schemaId")).toBe(false);
  expect(Object.hasOwn(schemaOnly, "mediaType")).toBe(false);
  expect(unconstrained).toEqual({});
});

it("prevents replacement of encoder selection criteria", () => {
  const proveReadonly = (selection: EncoderSelection, mediaType: MediaType): void => {
    // This helper remains compile-only so strict TypeScript checks the immutable
    // surface without mutating protocol planning fixtures at runtime.
    // @ts-expect-error The requested media type cannot be replaced.
    selection.mediaType = mediaType;
    // @ts-expect-error The requested schema identity cannot be replaced.
    selection.schemaId = "replacement.schema";
  };

  expectTypeOf(proveReadonly).toBeFunction();
});

it("does not identify or execute an encoder component", () => {
  // Component selection and execution remain separate later pipeline stages.
  expectTypeOf<EncoderSelection>().not.toHaveProperty("componentId");
  expectTypeOf<EncoderSelection>().not.toHaveProperty("encoder");
  expectTypeOf<EncoderSelection>().not.toHaveProperty("encode");
  expectTypeOf<EncoderSelection>().not.toHaveProperty("priority");
  expectTypeOf<EncoderSelection>().not.toHaveProperty("capabilities");
});
