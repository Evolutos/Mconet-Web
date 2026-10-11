// Copyright © 2026 Mcont.

import { expect, it } from "vitest";

import type { MessageRole } from "@evolutos/mconet-core-domain";

import {
  mapSystemMessageRoleToWire,
  mapSystemWireRoleToDomain,
} from "./map-system-message-role.js";

const systemRole: MessageRole = {
  id: "message.system",
  extensions: {},
};

it("maps the system role id to the system wire spelling", () => {
  expect(mapSystemMessageRoleToWire(systemRole)).toBe("system");
});

it("selects system from the role id and ignores descriptive fields", () => {
  const role: MessageRole = {
    id: "message.system",
    semantic: "assistant",
    rawValue: "SYSTEM",
    extensions: { "vendor.note": "user" },
  };

  expect(mapSystemMessageRoleToWire(role)).toBe("system");
});

it("maps the system wire spelling back to the standard system role", () => {
  const role = mapSystemWireRoleToDomain("system");

  expect(role.id).toBe("message.system");
  expect(role.rawValue).toBe("system");
  expect(role.semantic).toBeUndefined();
  expect(role.extensions).toEqual({});
  expect(Object.hasOwn(role, "semantic")).toBe(false);
});

it("does not coerce a different spelling or role into system", () => {
  expect(() => mapSystemMessageRoleToWire({ id: "message.user", extensions: {} })).toThrow(
    new TypeError("mapSystemMessageRoleToWire only maps message.system."),
  );
  expect(() => mapSystemWireRoleToDomain("System")).toThrow(
    new TypeError("mapSystemWireRoleToDomain only maps the system wire spelling."),
  );
  expect(() => mapSystemWireRoleToDomain(" assistant")).toThrow(TypeError);
});
