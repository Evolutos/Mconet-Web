// Copyright © 2026 Mcont.

import { expect, it } from "vitest";

import {
  ModelInteractionError,
  type Extensions,
  type JsonValue,
} from "@evolutos/mconet-core-domain";

import { OpenAIChatMessageDTO } from "./openai-chat-message-dto.js";

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

/**
 * Returns the normalized failure raised while reading one message.
 *
 * @param value Candidate decoded JSON.
 * @param path JSON Pointer passed to the reader.
 * @returns The protocol error.
 */
function protocolError(value: JsonValue, path = ""): ModelInteractionError {
  const error = capture(() => {
    OpenAIChatMessageDTO.fromJson(value, path);
  });
  expect(error).toBeInstanceOf(ModelInteractionError);
  if (!(error instanceof ModelInteractionError)) {
    throw new Error("Expected a model interaction error.");
  }
  expect(error.category).toBe("protocol");
  expect(error.phase).toBe("response_parsing");
  expect(error.code).toBe("invalid_protocol_response");
  return error;
}

/**
 * Constructs a message from runtime values that bypass the typed signature.
 *
 * @param role Candidate role.
 * @param content Candidate content.
 * @param extensions Candidate extension mapping.
 * @returns The constructed message when the values are accepted.
 */
function createMessage(
  role: unknown,
  content: unknown,
  extensions?: unknown,
): OpenAIChatMessageDTO {
  const Message = OpenAIChatMessageDTO as unknown as new (
    role: unknown,
    content: unknown,
    extensions?: unknown,
  ) => OpenAIChatMessageDTO;
  return new Message(role, content, extensions);
}

it("serializes only role and content in profile order", () => {
  const message = new OpenAIChatMessageDTO("user", "你好 世界 👋\n第二行");

  const encoded = message.toJson() as { role: string; content: string };
  encoded.content = "changed";

  expect(message.content).toBe("你好 世界 👋\n第二行");
  expect(message.toJson()).toEqual({ role: "user", content: "你好 世界 👋\n第二行" });
  expect(Object.keys(message.toJson())).toEqual(["role", "content"]);
  expect(message.extensions).toEqual({});
});

it("keeps text and role without normalization", () => {
  const message = new OpenAIChatMessageDTO("Assistant", "  e\u0301 \t");

  expect(message.role).toBe("Assistant");
  expect(message.content).toBe("  e\u0301 \t");
});

it("reads a decoded object and captures unknown members without sending them", () => {
  const vendor = { trace: [1, 2] };
  const decoded = {
    role: "assistant",
    content: "",
    refusal: null,
    vendor,
  };

  const message = OpenAIChatMessageDTO.fromJson(decoded, "/choices/0/message");
  vendor.trace[0] = 0;

  expect(message.role).toBe("assistant");
  expect(message.content).toBe("");
  expect(message.extensions).toEqual({
    refusal: null,
    vendor: { trace: [1, 2] },
  });
  expect(Object.keys(message.extensions)).toEqual(["refusal", "vendor"]);
  expect(message.toJson()).toEqual({ role: "assistant", content: "" });
});

it("rejects a non-object with its location", () => {
  const error = protocolError(["role", "user"], "/choices/0/message");

  expect(error.message).toBe(
    "OpenAI-compatible response field /choices/0/message must be an object.",
  );
});

it("rejects missing, null, or non-string members without echoing the payload", () => {
  const cases: readonly (readonly [JsonValue, string])[] = [
    [{ content: "text" }, "/m/role"],
    [{ role: null, content: "text" }, "/m/role"],
    [{ role: "user" }, "/m/content"],
    [{ role: "user", content: null }, "/m/content"],
    [{ role: "user", content: ["secret-text"] }, "/m/content"],
    [{ role: 1, content: "text" }, "/m/role"],
  ];
  for (const [decoded, location] of cases) {
    const error = protocolError(decoded, "/m");
    expect(error.message).toBe(`OpenAI-compatible response field ${location} must be a string.`);
    expect(error.message).not.toContain("secret-text");
  }
});

it("uses the root pointer when a message is read at the document root", () => {
  const error = protocolError("text");

  expect(error.message).toBe("OpenAI-compatible response field / must be an object.");
});

it("escapes member names in failure pointers", () => {
  const error = protocolError({ content: "text" }, "/a~0b/c~1d");

  expect(error.message).toBe("OpenAI-compatible response field /a~0b/c~1d/role must be a string.");
});

it("requires strings and portable extensions during construction", () => {
  const roleError = capture(() => {
    createMessage(null, "text");
  });
  const contentError = capture(() => {
    createMessage("user", 3);
  });
  const mappingError = capture(() => {
    createMessage("user", "text", []);
  });
  const keyError = capture(() => {
    const extensions: Record<PropertyKey, JsonValue> = {};
    extensions[Symbol("score")] = 1;
    createMessage("user", "text", extensions);
  });
  const numberError = capture(() => {
    createMessage("user", "text", { score: Number.NaN });
  });

  expect(roleError).toBeInstanceOf(TypeError);
  expect(roleError).toEqual(new TypeError("OpenAIChatMessageDTO role must be a string."));
  expect(contentError).toBeInstanceOf(TypeError);
  expect(contentError).toEqual(new TypeError("OpenAIChatMessageDTO content must be a string."));
  expect(mappingError).toBeInstanceOf(TypeError);
  expect(mappingError).toEqual(new TypeError("OpenAIChatMessageDTO extensions must be a mapping."));
  expect(keyError).toBeInstanceOf(TypeError);
  expect(keyError).toEqual(new TypeError("OpenAIChatMessageDTO extensions keys must be strings."));
  expect(numberError).toBeInstanceOf(RangeError);
  expect(numberError).toEqual(new RangeError("JSON floating-point value must be finite."));
});

it("freezes the message and detaches it from caller extensions", () => {
  const source: Record<string, JsonValue> = { vendor: true };
  const message = new OpenAIChatMessageDTO("assistant", "text", source);
  source.vendor = false;

  expect(message.extensions).toEqual({ vendor: true });
  expect(Object.isFrozen(message)).toBe(true);
  expect(Object.isFrozen(message.extensions)).toBe(true);
  expect(
    capture(() => {
      (message as { role: string }).role = "user";
    }),
  ).toBeInstanceOf(TypeError);
});

it("does not invoke extension accessors during construction", () => {
  let accessorReads = 0;
  const extensions: Extensions = {};
  Object.defineProperty(extensions, "vendor", {
    configurable: true,
    enumerable: true,
    get() {
      accessorReads += 1;
      return true;
    },
  });

  const error = capture(() => {
    new OpenAIChatMessageDTO("user", "text", extensions);
  });

  expect(error).toEqual(new TypeError("value must be a structurally valid JsonValue."));
  expect(accessorReads).toBe(0);
});

it("does not invoke accessors while rejecting a non-JSON object", () => {
  let accessorReads = 0;
  const decoded: Record<string, unknown> = { content: "text" };
  Object.defineProperty(decoded, "role", {
    configurable: true,
    enumerable: true,
    get() {
      accessorReads += 1;
      return "user";
    },
  });

  const error = capture(() => {
    OpenAIChatMessageDTO.fromJson(decoded);
  });

  expect(error).toBeInstanceOf(ModelInteractionError);
  expect(accessorReads).toBe(0);
});

it("rejects extension values that cannot travel as portable JSON", () => {
  const cycle: Record<string, unknown> = {};
  cycle.self = cycle;
  const negativeZeroError = capture(() => {
    createMessage("user", "text", { score: -0 });
  });
  const cycleError = capture(() => {
    createMessage("user", "text", cycle);
  });
  const nestedHostError = capture(() => {
    createMessage("user", "text", { when: new Date(0) });
  });

  expect(negativeZeroError).toEqual(new RangeError("JSON number must not be negative zero."));
  expect(cycleError).toEqual(new TypeError("value must be a structurally valid JsonValue."));
  expect(nestedHostError).toEqual(new TypeError("value must be a structurally valid JsonValue."));
});
