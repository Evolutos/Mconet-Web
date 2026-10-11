// Copyright © 2026 Mcont.

import { expect, it } from "vitest";

import type { MessageRole } from "@evolutos/mconet-core-domain";

import { mapUserMessageRoleToWire, mapUserWireRoleToDomain } from "./map-user-message-role.js";

const userRole: MessageRole = {
  id: "message.user",
  extensions: {},
};

it("maps the user role id to the user wire spelling", () => {
  expect(mapUserMessageRoleToWire(userRole)).toBe("user");
});

it("selects user from the role id and ignores descriptive fields", () => {
  const role: MessageRole = {
    id: "message.user",
    semantic: "assistant",
    rawValue: "SYSTEM",
    extensions: { "vendor.note": "system" },
  };

  expect(mapUserMessageRoleToWire(role)).toBe("user");
});

it("maps the user wire spelling back to the standard user role", () => {
  const role = mapUserWireRoleToDomain("user");

  expect(role.id).toBe("message.user");
  expect(role.rawValue).toBe("user");
  expect(role.semantic).toBeUndefined();
  expect(role.extensions).toEqual({});
  expect(Object.hasOwn(role, "semantic")).toBe(false);
});

it("does not coerce a different spelling or role into user", () => {
  expect(() => mapUserMessageRoleToWire({ id: "message.system", extensions: {} })).toThrow(
    new TypeError("mapUserMessageRoleToWire only maps message.user."),
  );
  expect(() => mapUserWireRoleToDomain("User")).toThrow(
    new TypeError("mapUserWireRoleToDomain only maps the user wire spelling."),
  );
});
