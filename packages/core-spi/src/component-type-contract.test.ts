// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type { OpenIdentifier } from "@evolutos/mconet-core-domain";

import type { ComponentTypeContract } from "./component-type-contract.js";

it("defines only optional readonly input and output port identities", () => {
  // Exact equality prevents component metadata, runtime values, capabilities,
  // matching results, or behavior from entering this narrow port contract.
  expectTypeOf<ComponentTypeContract>().toEqualTypeOf<{
    readonly inputTypeId?: OpenIdentifier;
    readonly inputSchemaId?: string;
    readonly outputTypeId?: OpenIdentifier;
    readonly outputSchemaId?: string;
  }>();
});

it("allows each port identity to be declared only when known", () => {
  const unspecified: ComponentTypeContract = {};
  const inputTypeOnly: ComponentTypeContract = {
    inputTypeId: "mconet.message.document",
  };
  const outputSchemaOnly: ComponentTypeContract = {
    outputSchemaId: "https://schemas.example.test/model-output.json",
  };
  const complete: ComponentTypeContract = {
    inputTypeId: "vendor.request.payload",
    inputSchemaId: "https://schemas.example.test/request.json",
    outputTypeId: "vendor.response.payload",
    outputSchemaId: "https://schemas.example.test/response.json",
  };

  // Runtime values remain plain caller-owned data. No constructor supplies
  // defaults or infers a missing type identity from a Schema identity.
  expect(unspecified).toEqual({});
  expect(inputTypeOnly).toEqual({ inputTypeId: "mconet.message.document" });
  expect(outputSchemaOnly).toEqual({
    outputSchemaId: "https://schemas.example.test/model-output.json",
  });
  expect(complete).toEqual({
    inputTypeId: "vendor.request.payload",
    inputSchemaId: "https://schemas.example.test/request.json",
    outputTypeId: "vendor.response.payload",
    outputSchemaId: "https://schemas.example.test/response.json",
  });
});

it("prevents replacement of every declared port identity", () => {
  const proveReadonly = (contract: ComponentTypeContract): void => {
    // These assignments are compiled but the helper is never invoked. Each
    // expected error independently locks one public port field as readonly.
    // @ts-expect-error Input semantic identity is immutable component metadata.
    contract.inputTypeId = "replacement.input";
    // @ts-expect-error Input Schema identity is immutable component metadata.
    contract.inputSchemaId = "replacement-input-schema";
    // @ts-expect-error Output semantic identity is immutable component metadata.
    contract.outputTypeId = "replacement.output";
    // @ts-expect-error Output Schema identity is immutable component metadata.
    contract.outputSchemaId = "replacement-output-schema";
  };

  // Retaining the helper in the test program ensures strict TypeScript checks
  // the forbidden writes without mutating a runtime fixture.
  expectTypeOf(proveReadonly).toBeFunction();
});
