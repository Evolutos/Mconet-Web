// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type { MediaType, OpenIdentifier } from "@evolutos/mconet-core-domain";

import type { ComponentTypeContract } from "./component-type-contract.js";

it("defines only optional readonly input and output port evidence", () => {
  // Exact equality prevents component metadata, runtime values, capabilities,
  // matching results, or behavior from entering this narrow port contract.
  expectTypeOf<ComponentTypeContract>().toEqualTypeOf<{
    readonly inputTypeId?: OpenIdentifier;
    readonly inputSchemaId?: string;
    readonly inputMediaTypes?: readonly MediaType[];
    readonly outputTypeId?: OpenIdentifier;
    readonly outputSchemaId?: string;
    readonly outputMediaTypes?: readonly MediaType[];
  }>();
});

it("allows each port declaration to be provided only when known", () => {
  // Use distinct immutable values to prove each port retains exactly the media
  // representations declared by the component without normalization or inference.
  const requestJson: MediaType = {
    type: "application",
    subtype: "json",
    parameters: { profile: "request" },
  };
  const responseJson: MediaType = {
    type: "application",
    subtype: "json",
    parameters: { profile: "response" },
  };
  const unspecified: ComponentTypeContract = {};
  const inputTypeOnly: ComponentTypeContract = {
    inputTypeId: "mconet.message.document",
  };
  const outputSchemaOnly: ComponentTypeContract = {
    outputSchemaId: "https://schemas.example.test/model-output.json",
  };
  const inputMediaTypesOnly: ComponentTypeContract = {
    inputMediaTypes: [requestJson],
  };
  const emptyOutputMediaTypes: ComponentTypeContract = {
    outputMediaTypes: [],
  };
  const complete: ComponentTypeContract = {
    inputTypeId: "vendor.request.payload",
    inputSchemaId: "https://schemas.example.test/request.json",
    inputMediaTypes: [requestJson],
    outputTypeId: "vendor.response.payload",
    outputSchemaId: "https://schemas.example.test/response.json",
    outputMediaTypes: [responseJson],
  };

  // Runtime values remain plain caller-owned data. No constructor supplies
  // defaults or infers a missing type identity from a Schema identity.
  expect(unspecified).toEqual({});
  expect(inputTypeOnly).toEqual({ inputTypeId: "mconet.message.document" });
  expect(outputSchemaOnly).toEqual({
    outputSchemaId: "https://schemas.example.test/model-output.json",
  });
  expect(inputMediaTypesOnly).toEqual({ inputMediaTypes: [requestJson] });
  expect(emptyOutputMediaTypes).toEqual({ outputMediaTypes: [] });
  expect(complete).toEqual({
    inputTypeId: "vendor.request.payload",
    inputSchemaId: "https://schemas.example.test/request.json",
    inputMediaTypes: [requestJson],
    outputTypeId: "vendor.response.payload",
    outputSchemaId: "https://schemas.example.test/response.json",
    outputMediaTypes: [responseJson],
  });
  expect(complete.inputMediaTypes?.[0]).toBe(requestJson);
  expect(complete.outputMediaTypes?.[0]).toBe(responseJson);
});

it("prevents replacement or mutation of every declared port field", () => {
  const proveReadonly = (contract: ComponentTypeContract): void => {
    // These assignments are compiled but the helper is never invoked. Each
    // expected error independently locks one public port field as readonly.
    // @ts-expect-error Input semantic identity is immutable component metadata.
    contract.inputTypeId = "replacement.input";
    // @ts-expect-error Input Schema identity is immutable component metadata.
    contract.inputSchemaId = "replacement-input-schema";
    // @ts-expect-error Input media declarations are immutable component metadata.
    contract.inputMediaTypes = [];
    // @ts-expect-error The readonly input collection cannot gain another representation.
    contract.inputMediaTypes?.push({ type: "text", subtype: "plain", parameters: {} });
    // @ts-expect-error Output semantic identity is immutable component metadata.
    contract.outputTypeId = "replacement.output";
    // @ts-expect-error Output Schema identity is immutable component metadata.
    contract.outputSchemaId = "replacement-output-schema";
    // @ts-expect-error Output media declarations are immutable component metadata.
    contract.outputMediaTypes = [];
    // @ts-expect-error The readonly output collection cannot gain another representation.
    contract.outputMediaTypes?.push({ type: "text", subtype: "plain", parameters: {} });
  };

  // Retaining the helper in the test program ensures strict TypeScript checks
  // the forbidden writes without mutating a runtime fixture.
  expectTypeOf(proveReadonly).toBeFunction();
});
