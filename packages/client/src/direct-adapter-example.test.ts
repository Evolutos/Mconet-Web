// Copyright © 2026 Mcont.

import { expect, it } from "vitest";

import {
  createDirectAdapterClient,
  createDirectAdapterRequest,
} from "../../../examples/custom-adapter/src/direct-adapter.js";

it("completes through the adapter supplied directly to the client", async () => {
  const client = createDirectAdapterClient();
  const output = await client.interact(createDirectAdapterRequest());

  expect(output.status).toBe("completed");
  expect(output.target.model.name).toBe("vendor-model");
});
