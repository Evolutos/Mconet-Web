// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type { ErrorCategory } from "./error-category.js";

const standardErrorCategories = [
  "invalid_request",
  "invalid_component_configuration",
  "unsupported_feature",
  "authentication",
  "permission",
  "rate_limit",
  "content_filter",
  "context_length",
  "timeout",
  "cancelled",
  "network",
  "serialization",
  "deserialization",
  "protocol",
  "model_service",
  "unknown",
] as const satisfies readonly ErrorCategory[];

it("includes every standard error category as a literal", () => {
  expectTypeOf<Extract<ErrorCategory, (typeof standardErrorCategories)[number]>>().toEqualTypeOf<
    (typeof standardErrorCategories)[number]
  >();
  expect(standardErrorCategories).toHaveLength(16);
});

it("preserves unknown current and future category strings", () => {
  const integrationCategory = "provider.future_category";
  const dynamicCategory: string = integrationCategory;
  const categories: readonly ErrorCategory[] = [integrationCategory, dynamicCategory];

  expectTypeOf<string>().toMatchTypeOf<ErrorCategory>();
  expect(categories).toEqual([integrationCategory, dynamicCategory]);
});

it("rejects non-string category representations", () => {
  expectTypeOf<number>().not.toMatchTypeOf<ErrorCategory>();
  expectTypeOf<boolean>().not.toMatchTypeOf<ErrorCategory>();
  expectTypeOf<null>().not.toMatchTypeOf<ErrorCategory>();
  expectTypeOf<{ readonly category: string }>().not.toMatchTypeOf<ErrorCategory>();
});
