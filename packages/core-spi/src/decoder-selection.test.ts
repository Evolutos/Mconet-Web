// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type { MediaType } from "@evolutos/mconet-core-domain";

import type { DecoderSelection } from "./decoder-selection.js";

it("defines only immutable decoder selection criteria", () => {
  // Exact equality prevents response metadata, component IDs, instances, bytes,
  // or executable decoding behavior from entering the pre-I/O planning value.
  expectTypeOf<DecoderSelection>().toEqualTypeOf<{
    readonly mediaType?: MediaType;
    readonly schemaId?: string;
  }>();
});

it("preserves planned media type and schema requirements", () => {
  const mediaType: MediaType = {
    type: "application",
    subtype: "problem+json",
    parameters: { charset: "utf-8" },
  };
  const selection: DecoderSelection = {
    mediaType,
    schemaId: "schema.protocol.error.v1",
  };

  // Planned criteria remain exact. Runtime Content-Type compatibility checks
  // inspect these values later but cannot rewrite or replace the selection.
  expect(selection.mediaType).toBe(mediaType);
  expect(selection.schemaId).toBe("schema.protocol.error.v1");
});

it("allows independent success and error decoder requirements", () => {
  const successSelection: DecoderSelection = {
    mediaType: { type: "application", subtype: "json", parameters: {} },
    schemaId: "schema.protocol.success.v1",
  };
  const errorSelection: DecoderSelection = {
    mediaType: { type: "application", subtype: "problem+json", parameters: {} },
    schemaId: "schema.protocol.error.v1",
  };

  // Separate values prevent the error path from silently borrowing the success
  // decoder contract when its representation or schema differs.
  expect(errorSelection).not.toBe(successSelection);
  expect(errorSelection.mediaType?.subtype).toBe("problem+json");
  expect(successSelection.mediaType?.subtype).toBe("json");
  expect(errorSelection.schemaId).not.toBe(successSelection.schemaId);
});

it("allows either criterion or both criteria to be omitted", () => {
  const mediaTypeOnly: DecoderSelection = {
    mediaType: { type: "application", subtype: "json", parameters: {} },
  };
  const schemaOnly: DecoderSelection = { schemaId: "schema.protocol.response.v2" };
  const unconstrained: DecoderSelection = {};

  // Absence remains explicit and never causes this value to infer a decoder from
  // response bytes or Content-Type after the request has already been sent.
  expect(Object.hasOwn(mediaTypeOnly, "schemaId")).toBe(false);
  expect(Object.hasOwn(schemaOnly, "mediaType")).toBe(false);
  expect(unconstrained).toEqual({});
});

it("prevents replacement of decoder selection criteria", () => {
  const proveReadonly = (selection: DecoderSelection, mediaType: MediaType): void => {
    // This helper remains compile-only so strict TypeScript verifies immutability
    // without mutating a planned response path during the runtime test.
    // @ts-expect-error The planned media type cannot be replaced.
    selection.mediaType = mediaType;
    // @ts-expect-error The planned schema identity cannot be replaced.
    selection.schemaId = "replacement.schema";
  };

  expectTypeOf(proveReadonly).toBeFunction();
});

it("does not identify execute or reselect a decoder", () => {
  // Selection, decoding, and response compatibility remain separate stages.
  expectTypeOf<DecoderSelection>().not.toHaveProperty("componentId");
  expectTypeOf<DecoderSelection>().not.toHaveProperty("decoder");
  expectTypeOf<DecoderSelection>().not.toHaveProperty("decode");
  expectTypeOf<DecoderSelection>().not.toHaveProperty("responseMetadata");
  expectTypeOf<DecoderSelection>().not.toHaveProperty("selectFromContentType");
});
