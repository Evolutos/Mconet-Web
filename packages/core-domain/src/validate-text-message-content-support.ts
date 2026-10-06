// Copyright © 2026 Mcont.

import type { MessageDocument } from "./message-document.js";
import type { MessageEntry } from "./message-entry.js";
import type { MessageGroup } from "./message-group.js";
import type { ProcessingResult } from "./processing-result.js";

/**
 * Validates that one structurally valid MessageDocument contains only text content.
 *
 * Traversal follows declared preorder and reports the first unsupported content
 * with a stable path. The function does not revalidate document structure, map
 * content, inspect an ArtifactCatalog, perform I/O, or modify the message tree.
 *
 * @param document Structurally validated MessageDocument to inspect.
 * @returns The original document, or one unsupported-content diagnostic.
 */
export function validateTextMessageContentSupport(
  document: MessageDocument,
): ProcessingResult<MessageDocument> {
  const pending: Array<{
    readonly element: MessageGroup | MessageEntry;
    readonly path: string;
  }> = [{ element: document.root, path: "root" }];

  while (pending.length > 0) {
    // The loop condition proves pop returns one frame. The structurally validated
    // document precondition keeps every queued element within the domain union.
    const frame = pending.pop() as (typeof pending)[number];

    if ("content" in frame.element) {
      // Entry and Group contracts use mutually exclusive content/children fields;
      // structural narrowing preserves open Group kinds without string casting.
      for (let index = 0; index < frame.element.content.length; index += 1) {
        // The bounded index and structurally valid dense content precondition
        // establish one concrete value without re-running shape validation.
        const content = frame.element.content[index] as (typeof frame.element.content)[number];
        if (content.kind !== "content.text") {
          // Stop at the first unsupported content in declared preorder so the
          // primary failure and its path remain deterministic.
          return {
            diagnostics: [
              {
                code: "unsupported_message_content",
                severity: "error",
                phase: "validation",
                message: "Only text message content is supported by this execution path.",
                path: `${frame.path}.content[${index}]`,
                details: {
                  contentId: content.id,
                  contentKind: content.kind,
                },
              },
            ],
          };
        }
      }
      continue;
    }

    // Push children in reverse so stack traversal observes the caller's original
    // left-to-right preorder without sorting or mutating the children array.
    for (let index = frame.element.children.length - 1; index >= 0; index -= 1) {
      // The bounded index and structurally valid dense children precondition
      // establish one concrete child without duplicating document validation.
      const child = frame.element.children[index] as (typeof frame.element.children)[number];
      pending.push({
        element: child,
        path: `${frame.path}.children[${index}]`,
      });
    }
  }

  // A successful range check returns the original document by identity and no
  // diagnostics, preserving every element and content reference.
  return {
    value: document,
    diagnostics: [],
  };
}
