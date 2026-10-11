// Copyright © 2026 Mcont.

import { expect, it } from "vitest";

import { ModelInteractionError } from "@evolutos/mconet-core-domain";

import { mapWireFinishReasonToDomain } from "./map-finish-reason.js";

it("preserves known and unknown reasons exactly", () => {
  for (const reason of [
    "stop",
    "length",
    "content_filter",
    "tool_calls",
    "Stop",
    "vendor.new_reason",
  ]) {
    expect(mapWireFinishReasonToDomain(reason)).toBe(reason);
  }
});

it("does not rewrite case or substitute unknown", () => {
  expect(mapWireFinishReasonToDomain("Length")).toBe("Length");
  expect(mapWireFinishReasonToDomain("Length")).not.toBe("length");
  expect(mapWireFinishReasonToDomain("Length")).not.toBe("unknown");
});

it("rejects a finish reason that is not an open identifier", () => {
  for (const reason of ["", "stop reason", ".stop", "a".repeat(129)]) {
    expect(() => mapWireFinishReasonToDomain(reason)).toThrow(ModelInteractionError);
    try {
      mapWireFinishReasonToDomain(reason);
    } catch (error) {
      expect(error).toBeInstanceOf(ModelInteractionError);
      expect((error as ModelInteractionError).code).toBe("invalid_finish_reason");
      if (reason.length > 0) {
        expect((error as ModelInteractionError).message).not.toContain(reason);
      }
    }
  }
});
