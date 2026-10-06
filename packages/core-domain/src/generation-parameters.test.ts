// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type { GenerationParameters } from "./generation-parameters.js";

it("defines only the five protocol-neutral generation controls", () => {
  // Exact equality excludes Message data, model selection, provider fields,
  // compatibility behavior, mutable containers, and unrelated Task options.
  expectTypeOf<GenerationParameters>().toEqualTypeOf<{
    readonly temperature?: number;
    readonly topP?: number;
    readonly maxOutputTokens?: number;
    readonly stop?: readonly string[];
    readonly seed?: number;
  }>();
});

it("allows every generation control to be omitted", () => {
  const parameters: GenerationParameters = {};

  // An empty Task configuration does not invent protocol defaults; adapters
  // can therefore distinguish caller omission from an explicitly sent value.
  expect(parameters).toEqual({});
});

it("retains complete caller input and stop order", () => {
  const stop = ["END", "\nUser:"] as const;
  const parameters: GenerationParameters = {
    temperature: 0.7,
    topP: 0.95,
    maxOutputTokens: 512,
    stop,
    seed: 42,
  };

  // Each control remains independent and the ordered stop reference is not
  // copied, sorted, deduplicated, normalized, or mapped to protocol fields.
  expect(parameters).toEqual({
    temperature: 0.7,
    topP: 0.95,
    maxOutputTokens: 512,
    stop: ["END", "\nUser:"],
    seed: 42,
  });
  expect(parameters.stop).toBe(stop);
});

it("defers field-specific semantic rules to the later validator", () => {
  const unchecked: GenerationParameters = {
    temperature: Number.NaN,
    topP: Number.POSITIVE_INFINITY,
    maxOutputTokens: 0,
    stop: ["", "duplicate", "duplicate"],
    seed: Number.MAX_SAFE_INTEGER + 1,
  };

  // Representation types deliberately retain invalid ranges and content so a
  // dedicated validator can report the precise failing field without coercion.
  expect(unchecked.maxOutputTokens).toBe(0);
  expect(unchecked.stop).toEqual(["", "duplicate", "duplicate"]);
  expect(unchecked.seed).toBe(Number.MAX_SAFE_INTEGER + 1);
});

it("prevents replacement of controls and mutation of stop order", () => {
  const proveReadonly = (parameters: GenerationParameters): void => {
    // Compile representative invalid writes while keeping this helper
    // unreachable from runtime tests and unable to mutate Task configuration.
    // @ts-expect-error Sampling temperature is immutable configuration data.
    parameters.temperature = 1;
    // @ts-expect-error The ordered stop collection reference is immutable.
    parameters.stop = ["later"];
    // @ts-expect-error Stop members cannot be inserted after construction.
    parameters.stop?.push("later");
    // @ts-expect-error A stop sequence cannot be replaced in place.
    if (parameters.stop !== undefined) parameters.stop[0] = "later";
  };

  // Retain the helper so strict TypeScript checks every readonly constraint
  // without running its intentionally invalid assignments.
  expectTypeOf(proveReadonly).toBeFunction();
});

it("rejects alternate scalar and stop representations", () => {
  // Booleans, strings, bigint counts, single stop strings, and mutable member
  // wrappers cannot masquerade as protocol-neutral generation controls.
  expectTypeOf<{ readonly temperature: boolean }>().not.toMatchTypeOf<GenerationParameters>();
  expectTypeOf<{ readonly topP: string }>().not.toMatchTypeOf<GenerationParameters>();
  expectTypeOf<{
    readonly maxOutputTokens: bigint;
  }>().not.toMatchTypeOf<GenerationParameters>();
  expectTypeOf<{ readonly stop: string }>().not.toMatchTypeOf<GenerationParameters>();
  expectTypeOf<{
    readonly stop: readonly { readonly value: string }[];
  }>().not.toMatchTypeOf<GenerationParameters>();
  expectTypeOf<{ readonly seed: string }>().not.toMatchTypeOf<GenerationParameters>();
});
