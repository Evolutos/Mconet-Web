// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import { ComponentCallRecorder } from "./component-call-recorder.js";

it("records component calls in exact observation order", () => {
  const recorder = new ComponentCallRecorder();

  // Construction owns an empty history and records nothing implicitly.
  expect(recorder.snapshot()).toEqual([]);

  // These labels model the production pipeline stages without making the
  // recorder depend on any concrete component interface.
  recorder.record("encode");
  recorder.record("authorize");
  recorder.record("send");
  recorder.record("decode");
  recorder.record("parse");

  expect(recorder.snapshot()).toEqual(["encode", "authorize", "send", "decode", "parse"]);
});

it("preserves repeated labels as distinct invocations", () => {
  const recorder = new ComponentCallRecorder();

  // Repeated transport attempts or monitor callbacks remain observable rather
  // than being deduplicated into a set or count.
  recorder.record("send");
  recorder.record("send");
  recorder.record("receive");

  expect(recorder.snapshot()).toEqual(["send", "send", "receive"]);
});

it("returns frozen snapshots detached from later calls", () => {
  const recorder = new ComponentCallRecorder();
  recorder.record("encode");
  const firstSnapshot = recorder.snapshot();

  recorder.record("authorize");
  const secondSnapshot = recorder.snapshot();

  // A previously asserted sequence cannot drift when another component records a
  // later call, and every consumer receives a distinct immutable array.
  expect(firstSnapshot).toEqual(["encode"]);
  expect(secondSnapshot).toEqual(["encode", "authorize"]);
  expect(firstSnapshot).not.toBe(secondSnapshot);
  expect(Object.isFrozen(firstSnapshot)).toBe(true);
  expect(Reflect.set(firstSnapshot, 0, "changed")).toBe(false);
  expect(recorder.snapshot()).toEqual(["encode", "authorize"]);
});

it("keeps histories isolated between recorder instances", () => {
  const first = new ComponentCallRecorder();
  const second = new ComponentCallRecorder();

  first.record("encode");
  second.record("send");

  // Instance-local private arrays prevent parallel fixtures from sharing call
  // history through module state.
  expect(first.snapshot()).toEqual(["encode"]);
  expect(second.snapshot()).toEqual(["send"]);
});

it("rejects ambiguous labels without changing history", () => {
  const recorder = new ComponentCallRecorder();
  recorder.record("encode");

  // Exact labels are caller-owned protocol between test doubles and assertions;
  // implicit trimming would make a typo appear to match the expected sequence.
  expect(() => recorder.record("")).toThrow(
    new TypeError("Component call label must be non-empty and contain no surrounding whitespace."),
  );
  expect(() => recorder.record(" authorize")).toThrow(TypeError);
  expect(() => recorder.record("send ")).toThrow(TypeError);
  // @ts-expect-error Runtime validation must reject untyped JavaScript input.
  expect(() => recorder.record(1)).toThrow(TypeError);
  expect(recorder.snapshot()).toEqual(["encode"]);
});

it("exposes only minimal record and snapshot operations", () => {
  // A zero-argument instance is shared explicitly by participating test doubles;
  // assertions consume snapshots without a dependency on a test framework.
  expectTypeOf<typeof ComponentCallRecorder>().constructorParameters.toEqualTypeOf<[]>();
  expectTypeOf<ComponentCallRecorder["record"]>().toEqualTypeOf<(label: string) => void>();
  expectTypeOf<ComponentCallRecorder["snapshot"]>().toEqualTypeOf<() => readonly string[]>();
  expectTypeOf<ComponentCallRecorder>().not.toHaveProperty("calls");
  expectTypeOf<ComponentCallRecorder>().not.toHaveProperty("reset");
  expectTypeOf<ComponentCallRecorder>().not.toHaveProperty("assertSequence");
});
