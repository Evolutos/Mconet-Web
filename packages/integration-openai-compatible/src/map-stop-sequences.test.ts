// Copyright © 2026 Mcont.

import { expect, it } from "vitest";

import { mapStopSequencesToWire } from "./map-stop-sequences.js";

it("omits absent stop sequences", () => {
  const omitted = mapStopSequencesToWire(undefined);

  expect(omitted.diagnostics).toEqual([]);
  expect(omitted.value).toEqual({});
  expect(Object.hasOwn(omitted.value as object, "stop")).toBe(false);
});

it("rejects an empty stop list instead of treating it as omission", () => {
  const mapped = mapStopSequencesToWire([]);

  expect(mapped.value).toBeUndefined();
  expect(mapped.diagnostics[0]).toMatchObject({
    code: "invalid_stop_sequences",
    severity: "error",
    path: "stop",
  });
});

it("keeps multiple stop sequences in order, including spaces and line breaks", () => {
  const source = ["\n", "END", " stop "];
  const mapped = mapStopSequencesToWire(source);

  expect(mapped.diagnostics).toEqual([]);
  expect(mapped.value?.stop).toEqual(["\n", "END", " stop "]);
  expect(mapped.value?.stop).not.toBe(source);
  expect(Object.isFrozen(mapped.value?.stop)).toBe(true);
});

it("rejects a list that contains an empty string", () => {
  const mapped = mapStopSequencesToWire(["END", ""]);

  expect(mapped.value).toBeUndefined();
  expect(mapped.diagnostics[0]?.code).toBe("invalid_stop_sequences");
});
