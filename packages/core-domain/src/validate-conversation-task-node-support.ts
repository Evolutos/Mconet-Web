// Copyright © 2026 Mcont.

import type { ProcessingResult } from "./processing-result.js";
import type { TaskDocument } from "./task-document.js";
import type { TaskNode } from "./task-node.js";

/** Traversal state for one Task node and its stable document location. */
interface TaskNodeFrame {
  readonly node: TaskNode;
  readonly path: string;
}

/**
 * Validates that a TaskDocument contains only executable conversation-task nodes.
 *
 * Structurally valid containers remain open grouping constructs. Conversation
 * input and generation configuration are the only leaf behaviors implemented by
 * the current execution path; every other leaf remains valid preserved data but
 * cannot be executed. This gate does not repeat document validation, inspect leaf
 * payloads, interpret container kinds, select components, or modify the tree.
 *
 * @param document Structurally validated TaskDocument to inspect.
 * @returns The original document, or the first unsupported-node diagnostic.
 */
export function validateConversationTaskNodeSupport(
  document: TaskDocument,
): ProcessingResult<TaskDocument> {
  const pending: TaskNodeFrame[] = [{ node: document.root, path: "root" }];

  while (pending.length > 0) {
    // The loop condition proves one frame exists. Complete TaskDocument
    // validation is the structural precondition for every queued node.
    const frame = pending.pop() as TaskNodeFrame;
    if (frame.node.composition === "leaf") {
      if (
        frame.node.kind !== "task.input.conversation" &&
        frame.node.kind !== "task.configuration"
      ) {
        // The path locates the unsupported value without copying its
        // producer-controlled ID, Kind, raw payload, metadata, or extensions
        // into a diagnostic that may later be logged or displayed.
        return {
          diagnostics: [
            {
              code: "unsupported_task_node",
              severity: "error",
              phase: "validation",
              message: "Conversation task contains an unsupported TaskNode.",
              path: frame.path,
            },
          ],
        };
      }
      continue;
    }

    // Open container kinds are valid grouping behavior. Reverse insertion makes
    // the explicit stack observe the declared left-to-right preorder without
    // sorting, copying, or recursively consuming the source tree.
    for (let index = frame.node.children.length - 1; index >= 0; index -= 1) {
      // The bounded index and structurally valid dense children precondition
      // establish one concrete TaskNode without repeating shape validation.
      const child = frame.node.children[index] as TaskNode;
      pending.push({ node: child, path: `${frame.path}.children[${index}]` });
    }
  }

  // Preserve the complete caller-owned document by identity; the support gate
  // never flattens groups, rebuilds leaves, or normalizes open identifiers.
  return { value: document, diagnostics: [] };
}
