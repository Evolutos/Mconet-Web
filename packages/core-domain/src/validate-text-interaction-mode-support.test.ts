// Copyright © 2026 Mcont.

import { expect, it } from "vitest";

import type { InteractionMode } from "./interaction-mode.js";
import { validateTextInteractionModeSupport } from "./validate-text-interaction-mode-support.js";

it.each(["unary", "server_stream"])("accepts %s by the same reference", (id) => {
  const mode: InteractionMode = { id };
  const result = validateTextInteractionModeSupport(mode);

  expect(result.diagnostics).toEqual([]);
  expect(result.value).toBe(mode);
});

it.each(["client_stream", "duplex", "long_running", "stream"])(
  "rejects %s before any other field is required",
  (id) => {
    const result = validateTextInteractionModeSupport({ id });

    expect(result.value).toBeUndefined();
    expect(result.diagnostics).toEqual([
      {
        code: "unsupported_interaction_mode",
        severity: "error",
        phase: "validation",
        message: "Text interaction supports unary and server_stream.",
        path: "id",
        details: {
          modeId: id,
          supportedModeIds: ["unary", "server_stream"],
        },
      },
    ]);
  },
);
