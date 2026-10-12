// Copyright © 2026 Mcont.

import { expect, it, vi } from "vitest";

import { releaseInteractionContext } from "./release-interaction-context.js";

it("releases the interaction context after a successful parse", async () => {
  const release = vi.fn();
  const result = await releaseInteractionContext({
    operation: async () => "parsed",
    release,
  });

  expect(result).toBe("parsed");
  expect(release).toHaveBeenCalledOnce();
});

it("releases the interaction context when parsing fails", async () => {
  const release = vi.fn();
  const failure = new Error("parse failed");

  await expect(
    releaseInteractionContext({
      operation: async () => {
        throw failure;
      },
      release,
    }),
  ).rejects.toBe(failure);
  expect(release).toHaveBeenCalledOnce();
});
