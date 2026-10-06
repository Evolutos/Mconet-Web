// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type { InteractionPhase } from "./interaction-phase.js";

const standardInteractionPhases = [
  "validation",
  "resolution",
  "planning",
  "encoding",
  "authorization",
  "transport",
  "decoding",
  "response_parsing",
] as const satisfies readonly InteractionPhase[];

it("includes every standard interaction phase as a literal", () => {
  expectTypeOf<
    Extract<InteractionPhase, (typeof standardInteractionPhases)[number]>
  >().toEqualTypeOf<(typeof standardInteractionPhases)[number]>();
  expect(standardInteractionPhases).toHaveLength(8);
});

it("preserves unknown current and future phase strings", () => {
  const integrationPhase = "provider.streaming_setup";
  const dynamicPhase: string = integrationPhase;
  const phases: readonly InteractionPhase[] = [integrationPhase, dynamicPhase];

  expectTypeOf<string>().toMatchTypeOf<InteractionPhase>();
  expect(phases).toEqual([integrationPhase, dynamicPhase]);
});

it("rejects non-string phase representations", () => {
  expectTypeOf<number>().not.toMatchTypeOf<InteractionPhase>();
  expectTypeOf<boolean>().not.toMatchTypeOf<InteractionPhase>();
  expectTypeOf<null>().not.toMatchTypeOf<InteractionPhase>();
  expectTypeOf<{ readonly phase: string }>().not.toMatchTypeOf<InteractionPhase>();
});
