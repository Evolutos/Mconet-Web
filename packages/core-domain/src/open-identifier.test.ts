// Copyright © 2026 Mcont.

import { describe, expect, it } from "vitest";

import { isOpenIdentifier, type OpenIdentifier } from "./open-identifier.js";

describe("isOpenIdentifier", () => {
  it.each(["conversation", "task.input.conversation", "vendor.custom-kind_v2", "扩展.文本"])(
    "accepts the open identifier %j",
    (value) => {
      expect(isOpenIdentifier(value)).toBe(true);
    },
  );

  it("narrows an unknown value to OpenIdentifier", () => {
    const candidate: unknown = "message.user";

    if (!isOpenIdentifier(candidate)) {
      throw new Error("Expected the test identifier to be valid.");
    }

    const identifier: OpenIdentifier = candidate;
    expect(identifier).toBe("message.user");
  });

  it.each([undefined, null, 0, true, {}, []])("rejects the non-string value %j", (value) => {
    expect(isOpenIdentifier(value)).toBe(false);
  });

  it.each(["", " ", "\t", " message.user", "message.user ", "message. user"])(
    "rejects blank or whitespace-containing input %j",
    (value) => {
      expect(isOpenIdentifier(value)).toBe(false);
    },
  );

  it("measures the length boundary in Unicode code points", () => {
    expect(isOpenIdentifier("a".repeat(128))).toBe(true);
    expect(isOpenIdentifier("a".repeat(129))).toBe(false);
    expect(isOpenIdentifier("😀".repeat(128))).toBe(true);
    expect(isOpenIdentifier("😀".repeat(129))).toBe(false);
  });

  it.each([".message", "message.", "message..user", "."])(
    "rejects an empty namespace segment in %j",
    (value) => {
      expect(isOpenIdentifier(value)).toBe(false);
    },
  );

  it.each(["message\u0000user", "message\u200Buser"])(
    "rejects control or invisible format characters in %j",
    (value) => {
      expect(isOpenIdentifier(value)).toBe(false);
    },
  );
});
