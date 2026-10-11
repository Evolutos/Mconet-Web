// Copyright © 2026 Mcont.

import { expect, it } from "vitest";

import { ModelInteractionError } from "@evolutos/mconet-core-domain";

import { validateAuthorizationHeaderName } from "./validate-authorization-header-name.js";

it("accepts one lowercase authorization header token", () => {
  expect(() => validateAuthorizationHeaderName("x-api-key")).not.toThrow();
  expect(() => validateAuthorizationHeaderName("authorization")).not.toThrow();
  expect(() => validateAuthorizationHeaderName("!#$%&'*+-.^_`|~")).not.toThrow();
});

it("rejects illegal authorization header name characters", () => {
  const names = [
    "",
    "X-Api-Key",
    "x api key",
    "x:api-key",
    "x-api-key\r\nX-Injected",
    "x-api-key\n",
  ];

  for (const name of names) {
    expect(() => validateAuthorizationHeaderName(name)).toThrow(ModelInteractionError);
    try {
      validateAuthorizationHeaderName(name);
    } catch (error) {
      expect(error).toMatchObject({
        category: "authentication",
        phase: "authorization",
        code: "invalid_authorization_header_name",
      });
      if (name.length > 0) {
        expect(String(error)).not.toContain(name);
      }
    }
  }
});
