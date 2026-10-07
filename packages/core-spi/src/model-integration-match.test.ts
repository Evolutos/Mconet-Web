// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type { Diagnostic } from "@evolutos/mconet-core-domain";

import type { ModelIntegrationMatch } from "./model-integration-match.js";
import type { ModelTargetMatch } from "./model-target-match.js";
import type { TaskMatch } from "./task-match.js";

it("defines only immutable target and task match positions", () => {
  // Exact equality keeps the composition limited to both completed outcomes;
  // interaction mode is already represented within the task match result.
  expectTypeOf<ModelIntegrationMatch>().toEqualTypeOf<{
    readonly target: ModelTargetMatch;
    readonly task: TaskMatch;
  }>();
});

it("preserves target and task match identities with independent facts", () => {
  const targetDiagnostic: Diagnostic = {
    code: "target_matched",
    severity: "info",
    phase: "resolution",
    message: "The model target matched the integration.",
  };
  const taskDiagnostic: Diagnostic = {
    code: "task_mode_matched",
    severity: "info",
    phase: "resolution",
    message: "The task and interaction mode matched the integration.",
  };
  const target: ModelTargetMatch = {
    matched: true,
    score: 400,
    diagnostics: [targetDiagnostic],
  };
  const task: TaskMatch = {
    matched: true,
    score: 200,
    diagnostics: [taskDiagnostic],
  };
  const match: ModelIntegrationMatch = { target, task };

  // Identity preservation avoids copying or rewriting nested scores and
  // observations while keeping their target and task ownership visible.
  expect(match.target).toBe(target);
  expect(match.task).toBe(task);
  expect(match.target.score).toBe(400);
  expect(match.target.diagnostics).toEqual([targetDiagnostic]);
  expect(match.task.score).toBe(200);
  expect(match.task.diagnostics).toEqual([taskDiagnostic]);
});

it("preserves partial matches without inferring an aggregate decision", () => {
  const diagnostic: Diagnostic = {
    code: "interaction_mode_unsupported",
    severity: "info",
    phase: "resolution",
    message: "The requested interaction mode is not supported.",
  };
  const target: ModelTargetMatch = { matched: true, score: 100, diagnostics: [] };
  const task: TaskMatch = {
    matched: false,
    score: -1,
    diagnostics: [diagnostic],
  };
  const match: ModelIntegrationMatch = { target, task };

  // A resolver needs both outcomes to reject and explain a candidate. The
  // carrier therefore retains the partial match rather than collapsing it.
  expect(match.target.matched).toBe(true);
  expect(match.target.score).toBe(100);
  expect(match.task.matched).toBe(false);
  expect(match.task.score).toBe(-1);
  expect(match.task.diagnostics[0]).toBe(diagnostic);
  expectTypeOf<ModelIntegrationMatch>().not.toHaveProperty("matched");
  expectTypeOf<ModelIntegrationMatch>().not.toHaveProperty("score");
  expectTypeOf<ModelIntegrationMatch>().not.toHaveProperty("diagnostics");
});

it("prevents replacement of either nested match outcome", () => {
  const proveReadonly = (
    match: ModelIntegrationMatch,
    target: ModelTargetMatch,
    task: TaskMatch,
  ): void => {
    // This helper remains compile-only so strict TypeScript verifies completed
    // target and task outcomes cannot be replaced after composition.
    // @ts-expect-error The target match position cannot be replaced.
    match.target = target;
    // @ts-expect-error The task match position cannot be replaced.
    match.task = task;
  };

  expectTypeOf(proveReadonly).toBeFunction();
});

it("does not duplicate mode, specificity, binding, or resolver behavior", () => {
  // TaskMatch already includes interaction-mode matching, while binding choice
  // and aggregate ranking remain deterministic resolver responsibilities.
  expectTypeOf<ModelIntegrationMatch>().not.toHaveProperty("mode");
  expectTypeOf<ModelIntegrationMatch>().not.toHaveProperty("taskSpecificity");
  expectTypeOf<ModelIntegrationMatch>().not.toHaveProperty("modeSpecificity");
  expectTypeOf<ModelIntegrationMatch>().not.toHaveProperty("binding");
  expectTypeOf<ModelIntegrationMatch>().not.toHaveProperty("rank");
  expectTypeOf<ModelIntegrationMatch>().not.toHaveProperty("resolve");
});
