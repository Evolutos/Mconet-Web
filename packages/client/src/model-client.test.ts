// Copyright © 2026 Mcont.

import type { ModelOutput, ModelRequest } from "@evolutos/mconet-core-domain";
import type { InteractionOptions } from "@evolutos/mconet-core-spi";
import { expect, expectTypeOf, it } from "vitest";

import type { ModelClient } from "./model-client.js";

it("defines interact and close", () => {
  // Equality keeps streaming and disposal symbols off the R1 client contract.
  expectTypeOf<ModelClient>().toEqualTypeOf<{
    interact(request: ModelRequest, options?: InteractionOptions): Promise<ModelOutput>;
    close(): Promise<void>;
  }>();
});

it("accepts a client whose close is a separate promise", async () => {
  let closed = 0;
  const client: ModelClient = {
    interact: () => Promise.reject(new Error("unused")),
    close: () => {
      closed += 1;
      return Promise.resolve();
    },
  };

  // The type adds no close implementation. The supplied function is what runs.
  await client.close();
  expect(closed).toBe(1);
});
