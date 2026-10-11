// Copyright © 2026 Mcont.

import { expect, it } from "vitest";

import { ModelInteractionError } from "@evolutos/mconet-core-domain";

import { validateAuthorizationHeaderValue } from "./validate-authorization-header-value.js";

it("accepts an authorization header value that stays in one field", () => {
  expect(() => validateAuthorizationHeaderValue("Bearer token")).not.toThrow();
  expect(() => validateAuthorizationHeaderValue("token:value")).not.toThrow();
  expect(() => validateAuthorizationHeaderValue("")).not.toThrow();
});

it("rejects carriage return and line feed injection", () => {
  const values = ["token\r\nX-Injected: 1", "token\nX-Injected: 1", "token\rX-Injected: 1"];

  for (const value of values) {
    expect(() => validateAuthorizationHeaderValue(value)).toThrow(ModelInteractionError);
    try {
      validateAuthorizationHeaderValue(value);
    } catch (error) {
      expect(error).toMatchObject({
        category: "authentication",
        phase: "authorization",
        code: "invalid_authorization_header_value",
      });
      expect(String(error)).not.toContain("X-Injected");
      expect(String(error)).not.toContain("token");
    }
  }
});
