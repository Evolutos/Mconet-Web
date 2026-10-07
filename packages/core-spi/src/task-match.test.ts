// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type { Diagnostic } from "@evolutos/mconet-core-domain";

import type { TaskMatch } from "./task-match.js";

it("defines only immutable task execution matching facts", () => {
  // Exact equality prevents the task, interaction mode, matcher, component,
  // aggregate rank, or selection behavior from entering one match outcome.
  expectTypeOf<TaskMatch>().toEqualTypeOf<{
    readonly matched: boolean;
    readonly score: number;
    readonly diagnostics: readonly Diagnostic[];
  }>();
});

it("preserves an applicable task and mode score with ordered diagnostics", () => {
  const taskDiagnostic: Diagnostic = {
    code: "task_exact_match",
    severity: "info",
    phase: "resolution",
    message: "The task identifier matched exactly.",
  };
  const modeDiagnostic: Diagnostic = {
    code: "interaction_mode_match",
    severity: "info",
    phase: "resolution",
    message: "The interaction mode is supported by the integration.",
  };
  const diagnostics = [taskDiagnostic, modeDiagnostic] as const;
  const match: TaskMatch = {
    matched: true,
    score: 200,
    diagnostics,
  };

  // The carrier retains matcher-owned values and task-then-mode observations.
  // It does not normalize score dimensions or calculate a resolver ranking.
  expect(match.matched).toBe(true);
  expect(match.score).toBe(200);
  expect(match.diagnostics).toBe(diagnostics);
  expect(match.diagnostics).toEqual([taskDiagnostic, modeDiagnostic]);
});

it("represents an explicit non-match without discarding observations", () => {
  const diagnostic: Diagnostic = {
    code: "interaction_mode_mismatch",
    severity: "info",
    phase: "resolution",
    message: "The requested interaction mode is not supported.",
  };
  const match: TaskMatch = {
    matched: false,
    score: -5,
    diagnostics: [diagnostic],
  };

  // A false decision remains independent from score sign and still carries the
  // stable observation that explains why task execution is not applicable.
  expect(match.matched).toBe(false);
  expect(match.score).toBe(-5);
  expect(match.diagnostics[0]).toBe(diagnostic);
});

it("allows the task matcher score scale to remain open", () => {
  const weaker: TaskMatch = { matched: true, score: -10, diagnostics: [] };
  const neutral: TaskMatch = { matched: true, score: 0, diagnostics: [] };
  const stronger: TaskMatch = { matched: true, score: 10_000, diagnostics: [] };

  // The value preserves signed matcher-owned scores. Integer validation and
  // comparison policy belong to the boundary and resolver that create/use it.
  expect([weaker.score, neutral.score, stronger.score]).toEqual([-10, 0, 10_000]);
});

it("prevents replacement or mutation of task matching facts", () => {
  const proveReadonly = (match: TaskMatch, diagnostic: Diagnostic): void => {
    // This helper remains compile-only so strict TypeScript locks the outcome
    // without mutating a completed task matching result at runtime.
    // @ts-expect-error The applicability decision cannot be replaced.
    match.matched = false;
    // @ts-expect-error The matcher-owned score cannot be replaced.
    match.score = 0;
    // @ts-expect-error The ordered diagnostic collection cannot be replaced.
    match.diagnostics = [];
    // @ts-expect-error Readonly arrays cannot gain diagnostics.
    match.diagnostics.push(diagnostic);
  };

  expectTypeOf(proveReadonly).toBeFunction();
});

it("does not retain matcher inputs, components, or resolver behavior", () => {
  // Task descriptors, modes, matchers, and selected components remain owned by
  // orchestration so this result cannot create inconsistent duplicate snapshots.
  expectTypeOf<TaskMatch>().not.toHaveProperty("task");
  expectTypeOf<TaskMatch>().not.toHaveProperty("mode");
  expectTypeOf<TaskMatch>().not.toHaveProperty("matcher");
  expectTypeOf<TaskMatch>().not.toHaveProperty("component");
  expectTypeOf<TaskMatch>().not.toHaveProperty("rank");
  expectTypeOf<TaskMatch>().not.toHaveProperty("select");
});
