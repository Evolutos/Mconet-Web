// Copyright © 2026 Mcont.

import { expect, it } from "vitest";

import type { MessageRole } from "@evolutos/mconet-core-domain";

import {
  mapAssistantMessageRoleToWire,
  mapAssistantWireRoleToDomain,
} from "./map-assistant-message-role.js";

const assistantRole: MessageRole = {
  id: "message.assistant",
  extensions: {},
};

it("maps the assistant role id to the assistant wire spelling", () => {
  expect(mapAssistantMessageRoleToWire(assistantRole)).toBe("assistant");
});

it("selects assistant from the role id and ignores descriptive fields", () => {
  const role: MessageRole = {
    id: "message.assistant",
    semantic: "user",
    rawValue: "SYSTEM",
    extensions: { "vendor.note": "system" },
  };

  expect(mapAssistantMessageRoleToWire(role)).toBe("assistant");
});

it("maps the assistant wire spelling back to the standard assistant role", () => {
  const role = mapAssistantWireRoleToDomain("assistant");

  expect(role.id).toBe("message.assistant");
  expect(role.rawValue).toBe("assistant");
  expect(role.semantic).toBeUndefined();
  expect(role.extensions).toEqual({});
  expect(Object.hasOwn(role, "semantic")).toBe(false);
});

it("does not coerce a different spelling or role into assistant", () => {
  expect(() => mapAssistantMessageRoleToWire({ id: "message.user", extensions: {} })).toThrow(
    new TypeError("mapAssistantMessageRoleToWire only maps message.assistant."),
  );
  expect(() => mapAssistantWireRoleToDomain("Assistant")).toThrow(
    new TypeError("mapAssistantWireRoleToDomain only maps the assistant wire spelling."),
  );
});
