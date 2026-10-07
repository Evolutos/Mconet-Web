// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type { Diagnostic } from "@evolutos/mconet-core-domain";

import type { ModelTargetMatch } from "./model-target-match.js";

it("defines only immutable model target matching facts", () => {
  // Exact equality prevents the target, matcher, binding, component candidates,
  // aggregate rank, or selection behavior from entering one match outcome.
  expectTypeOf<ModelTargetMatch>().toEqualTypeOf<{
    readonly matched: boolean;
    readonly score: number;
    readonly diagnostics: readonly Diagnostic[];
  }>();
});

it("preserves an applicable match score and ordered diagnostics", () => {
  const serviceDiagnostic: Diagnostic = {
    code: "service_exact_match",
    severity: "info",
    phase: "resolution",
    message: "The service identifier matched exactly.",
    serviceId: "service.example",
  };
  const modelDiagnostic: Diagnostic = {
    code: "model_family_match",
    severity: "info",
    phase: "resolution",
    message: "The model family matched the integration rule.",
  };
  const diagnostics = [serviceDiagnostic, modelDiagnostic] as const;
  const match: ModelTargetMatch = {
    matched: true,
    score: 120,
    diagnostics,
  };

  // The carrier retains matcher-owned values and order. It does not normalize
  // score dimensions, merge observations, or calculate a resolver ranking.
  expect(match.matched).toBe(true);
  expect(match.score).toBe(120);
  expect(match.diagnostics).toBe(diagnostics);
  expect(match.diagnostics).toEqual([serviceDiagnostic, modelDiagnostic]);
});

it("represents an explicit non-match without discarding observations", () => {
  const diagnostic: Diagnostic = {
    code: "protocol_mismatch",
    severity: "info",
    phase: "resolution",
    message: "The requested protocol is not handled by this integration.",
  };
  const match: ModelTargetMatch = {
    matched: false,
    score: 0,
    diagnostics: [diagnostic],
  };

  // A false decision is a completed evaluation rather than absence. Diagnostic
  // facts remain available for deterministic resolver reporting and testing.
  expect(match.matched).toBe(false);
  expect(match.score).toBe(0);
  expect(match.diagnostics[0]).toBe(diagnostic);
});

it("allows the matcher score scale to remain open", () => {
  const weaker: ModelTargetMatch = { matched: true, score: -10, diagnostics: [] };
  const neutral: ModelTargetMatch = { matched: true, score: 0, diagnostics: [] };
  const stronger: ModelTargetMatch = { matched: true, score: 10_000, diagnostics: [] };

  // The value preserves signed matcher-owned scores. Integer validation and
  // comparison policy belong to the boundary and resolver that create/use it.
  expect([weaker.score, neutral.score, stronger.score]).toEqual([-10, 0, 10_000]);
});

it("prevents replacement or mutation of matching facts", () => {
  const proveReadonly = (match: ModelTargetMatch, diagnostic: Diagnostic): void => {
    // This helper remains compile-only so strict TypeScript locks the outcome
    // without mutating a completed matcher result at runtime.
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

it("does not retain target candidates or resolver behavior", () => {
  // Matching and binding selection remain separate deterministic stages.
  expectTypeOf<ModelTargetMatch>().not.toHaveProperty("target");
  expectTypeOf<ModelTargetMatch>().not.toHaveProperty("matcher");
  expectTypeOf<ModelTargetMatch>().not.toHaveProperty("binding");
  expectTypeOf<ModelTargetMatch>().not.toHaveProperty("candidates");
  expectTypeOf<ModelTargetMatch>().not.toHaveProperty("rank");
  expectTypeOf<ModelTargetMatch>().not.toHaveProperty("select");
});
