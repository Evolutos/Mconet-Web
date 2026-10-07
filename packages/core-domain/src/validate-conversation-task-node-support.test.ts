// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type { MessageGroup } from "./message-group.js";
import type { ProcessingResult } from "./processing-result.js";
import type { TaskDocument } from "./task-document.js";
import type { TaskNode } from "./task-node.js";
import { validateConversationTaskNodeSupport } from "./validate-conversation-task-node-support.js";

it("returns the original document when every leaf is executable", () => {
  const input = createConversationInput("input");
  const parameters = createParameters("parameters");
  const group = createGroup("section", "vendor.section", [input, parameters]);
  const document = createDocument([group]);
  const before = structuredClone(document);
  const result = validateConversationTaskNodeSupport(document);

  // Identity and deep equality prove traversal does not flatten groups,
  // normalize open container kinds, copy leaves, or change collection order.
  expect(result).toEqual({ value: document, diagnostics: [] });
  expect(result.value).toBe(document);
  expect(document).toEqual(before);
  expect(group.children).toEqual([input, parameters]);
});

it("rejects an unknown leaf with a content-safe stable diagnostic", () => {
  const privateId = "private-node-token";
  const privateKind = "vendor.private_node_token";
  const document = createDocument([
    createConversationInput("input"),
    createUnknown(privateId, privateKind),
  ]);
  const result = validateConversationTaskNodeSupport(document);

  // The structural path identifies the value while producer-controlled node
  // data remains absent from the result and its displayable message.
  expect(result).toEqual({
    diagnostics: [
      {
        code: "unsupported_task_node",
        severity: "error",
        phase: "validation",
        message: "Conversation task contains an unsupported TaskNode.",
        path: "root.children[1]",
      },
    ],
  });
  expect(JSON.stringify(result)).not.toContain(privateId);
  expect(JSON.stringify(result)).not.toContain(privateKind);
  expect(Object.hasOwn(result, "value")).toBe(false);
});

it("reports the first nested unknown leaf in declared preorder", () => {
  const first = createUnknown("first", "vendor.first");
  const second = createUnknown("second", "vendor.second");
  const document = createDocument([
    createGroup("left", "task.group", [createConversationInput("input"), first]),
    createGroup("right", "vendor.group", [second]),
  ]);

  // Reversed stack insertion must still visit the left branch before the later
  // sibling branch and therefore produce a deterministic primary failure.
  const result = validateConversationTaskNodeSupport(document);
  expect(result.diagnostics[0]?.path).toBe("root.children[0].children[1]");
});

it("allows integration-defined groups while inspecting their descendants", () => {
  const document = createDocument([
    createGroup("vendor-container", "vendor.workflow.section", [
      createConversationInput("input"),
      createParameters("parameters"),
    ]),
  ]);

  // Open TaskGroupNode kinds remain structural containers; only preserved leaf
  // variants lack concrete execution behavior in this profile.
  expect(validateConversationTaskNodeSupport(document).value).toBe(document);
});

it("does not add unrelated conversation-request validation", () => {
  const document = createDocument([]);

  // Input existence, Message purpose, parameter ranges, relations, and IDs are
  // owned by earlier validators. This gate answers only whether observed node
  // variants have current execution behavior.
  expect(validateConversationTaskNodeSupport(document)).toEqual({
    value: document,
    diagnostics: [],
  });
});

it("does not read protected unknown-leaf fields before rejection", () => {
  let protectedReadCount = 0;
  const rejectProtectedRead = (): never => {
    // Any access demonstrates that the support check has exceeded the Kind and
    // composition fields required for its single decision.
    protectedReadCount += 1;
    throw new Error("protected unknown-node data must not be read");
  };
  const unknown = {
    get id(): never {
      return rejectProtectedRead();
    },
    kind: "vendor.future",
    composition: "leaf",
    get raw(): never {
      return rejectProtectedRead();
    },
    get relations(): never {
      return rejectProtectedRead();
    },
    get metadata(): never {
      return rejectProtectedRead();
    },
    get extensions(): never {
      return rejectProtectedRead();
    },
  } as TaskNode;
  const document = createDocument([unknown]);

  // The typed precondition places full structural validation before this gate;
  // Kind and composition alone are sufficient to reject an unknown leaf.
  const result = validateConversationTaskNodeSupport(document);
  expect(result.diagnostics[0]?.code).toBe("unsupported_task_node");
  expect(protectedReadCount).toBe(0);
});

it("uses iterative traversal for deeply nested supported groups", () => {
  let node: TaskNode = createConversationInput("input");
  for (let depth = 0; depth < 10_000; depth += 1) {
    // A single-child chain beyond ordinary recursion depth remains bounded work
    // for the explicit stack and retains its original node objects.
    node = createGroup(`group-${depth}`, "task.group", [node]);
  }
  const document = createDocument([node]);

  expect(() => validateConversationTaskNodeSupport(document)).not.toThrow();
  expect(validateConversationTaskNodeSupport(document).value).toBe(document);
});

it("exposes one narrow TaskDocument processing signature", () => {
  // Whole-document input is necessary because preserved leaves may occur at any
  // depth, while the successful result retains that authoritative document.
  expectTypeOf(validateConversationTaskNodeSupport).toEqualTypeOf<
    (document: TaskDocument) => ProcessingResult<TaskDocument>
  >();
});

/** Creates one complete TaskDocument with caller-selected root children. */
function createDocument(children: readonly TaskNode[]): TaskDocument {
  return {
    version: "1.0",
    root: createGroup("root", "task.root", children),
    metadata: {},
    extensions: {},
  };
}

/** Creates one open Task group without assigning leaf behavior. */
function createGroup(
  id: string,
  kind: string,
  children: readonly TaskNode[],
): TaskDocument["root"] {
  return {
    id,
    kind,
    composition: "container",
    children,
    relations: [],
    metadata: {},
    extensions: {},
  };
}

/** Creates one executable conversation-input leaf. */
function createConversationInput(id: string): TaskNode {
  return {
    id,
    kind: "task.input.conversation",
    composition: "leaf",
    messages: {
      version: "1.0",
      purpose: "input",
      root: createMessageRoot(),
      metadata: {},
      extensions: {},
    },
    relations: [],
    metadata: {},
    extensions: {},
  };
}

/** Creates one executable generation-parameter leaf. */
function createParameters(id: string): TaskNode {
  return {
    id,
    kind: "task.configuration",
    composition: "leaf",
    parameters: { temperature: 0.25 },
    relations: [],
    metadata: {},
    extensions: {},
  };
}

/** Creates one preservation-only unknown leaf. */
function createUnknown(id: string, kind: string): TaskNode {
  return {
    id,
    kind,
    composition: "leaf",
    raw: { bytes: { retained: true }, truncated: false, metadata: {} },
    relations: [],
    metadata: { private: "not-diagnostic-data" },
    extensions: {},
  };
}

/** Creates the smallest complete empty Message root group. */
function createMessageRoot(): MessageGroup {
  return {
    id: "messages",
    kind: "message.root",
    composition: "container",
    children: [],
    relations: [],
    metadata: {},
    extensions: {},
  };
}
