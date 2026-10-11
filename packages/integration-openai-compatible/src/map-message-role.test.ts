// Copyright © 2026 Mcont.

import { expect, it } from "vitest";

import { ModelInteractionError, type MessageRole } from "@evolutos/mconet-core-domain";

import { mapMessageRoleToWire, mapWireRoleToDomain } from "./map-message-role.js";

const standardRoles = [
  ["message.system", "system"],
  ["message.user", "user"],
  ["message.assistant", "assistant"],
] as const;

const rolePath = "/choices/0/message/role";

/**
 * Runs one action and returns the exception it raises.
 *
 * @param action Operation expected to fail.
 * @returns The thrown value.
 */
function capture(action: () => void): unknown {
  try {
    action();
  } catch (error) {
    return error;
  }
  throw new Error("Expected the action to fail.");
}

it("maps system, user, and assistant to their wire spellings", () => {
  for (const [roleId, spelling] of standardRoles) {
    expect(mapMessageRoleToWire({ id: roleId, extensions: {} })).toBe(spelling);
  }
});

it("selects the spelling from the role id and ignores descriptive fields", () => {
  const role: MessageRole = {
    id: "message.user",
    semantic: "assistant",
    rawValue: "SYSTEM",
    extensions: {},
  };

  expect(mapMessageRoleToWire(role)).toBe("user");
});

it("rejects unknown request roles without falling back", () => {
  const roles: readonly MessageRole[] = [
    { id: "message.tool", extensions: {} },
    { id: "message.developer", extensions: {} },
    { id: "vendor.reviewer", semantic: "user", rawValue: "user", extensions: {} },
  ];
  for (const role of roles) {
    const error = capture(() => {
      mapMessageRoleToWire(role);
    });

    expect(error).toBeInstanceOf(ModelInteractionError);
    if (!(error instanceof ModelInteractionError)) {
      throw new Error("Expected a model interaction error.");
    }
    expect(error.category).toBe("unsupported_feature");
    expect(error.phase).toBe("protocol_adaptation");
    expect(error.code).toBe("unsupported_message_role");
    expect(error.message).toBe(
      `Message role ${role.id} is not supported by the OpenAI-compatible chat completions protocol.`,
    );
    expect(error.message).not.toContain("semantic");
  }
});

it("maps response spellings back to standard roles and keeps the wire text", () => {
  for (const [roleId, spelling] of standardRoles) {
    const role = mapWireRoleToDomain(spelling, rolePath);

    expect(role.id).toBe(roleId);
    expect(role.rawValue).toBe(spelling);
    expect(role.semantic).toBeUndefined();
    expect(role.extensions).toEqual({});
  }
});

it("rejects unknown response spellings without coercion", () => {
  for (const spelling of ["tool", "Assistant", "", " assistant"]) {
    const error = capture(() => {
      mapWireRoleToDomain(spelling, rolePath);
    });

    expect(error).toBeInstanceOf(ModelInteractionError);
    if (!(error instanceof ModelInteractionError)) {
      throw new Error("Expected a model interaction error.");
    }
    expect(error.category).toBe("protocol");
    expect(error.phase).toBe("response_parsing");
    expect(error.code).toBe("invalid_protocol_response");
    expect(error.message).toBe(
      "OpenAI-compatible response field /choices/0/message/role must be assistant, system, or user.",
    );
  }
});
