// Copyright © 2026 Mcont.

import { expect, it, vi } from "vitest";

import { releaseInteractionResponse } from "./release-interaction-response.js";

it("releases the response after a successful operation", async () => {
  const release = vi.fn();
  const result = await releaseInteractionResponse({
    operation: async () => "decoded",
    release,
  });

  expect(result).toBe("decoded");
  expect(release).toHaveBeenCalledOnce();
});

it("releases the response when decoding fails", async () => {
  const release = vi.fn();
  const failure = new Error("decode failed");

  await expect(
    releaseInteractionResponse({
      operation: async () => {
        throw failure;
      },
      release,
    }),
  ).rejects.toBe(failure);
  expect(release).toHaveBeenCalledOnce();
});
