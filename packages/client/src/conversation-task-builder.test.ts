// Copyright © 2026 Mcont.

import type { ConversationTaskRequest } from "@evolutos/mconet-core-domain";
import { expect, it } from "vitest";

import { ConversationTaskBuilder } from "./index.js";

it("builds the same conversation task as a direct request", () => {
  const document = createDocument();
  const artifacts = { artifacts: [] };
  const metadata = { locale: "en" } as const;
  const extensions = { "vendor.trace": true } as const;
  const built = new ConversationTaskBuilder(document)
    .withArtifacts(artifacts)
    .withMetadata(metadata)
    .withExtensions(extensions)
    .build();
  const direct: ConversationTaskRequest = {
    descriptor: { type: "conversation.generate", metadata: {}, extensions: {} },
    document,
    artifacts,
    metadata,
    extensions,
  };

  // The public builder is the domain builder. Equality is the same task value.
  expect(built).toEqual(direct);
  expect(built.document).toBe(document);
  expect(built.artifacts).toBe(artifacts);
  expect(built.metadata).toBe(metadata);
  expect(built.extensions).toBe(extensions);
});

function createDocument() {
  return {
    version: "1.0",
    root: {
      id: "task-root",
      kind: "task.root" as const,
      composition: "container" as const,
      children: [
        {
          id: "conversation-input",
          kind: "task.input.conversation" as const,
          composition: "leaf" as const,
          messages: {
            version: "1.0",
            purpose: "input" as const,
            root: {
              id: "message-root",
              kind: "message.root" as const,
              composition: "container" as const,
              children: [
                {
                  id: "message-user",
                  kind: "message.entry" as const,
                  role: { id: "message.user", extensions: {} },
                  content: [
                    {
                      id: "content-user",
                      kind: "content.text" as const,
                      text: "Hello",
                      metadata: {},
                      extensions: {},
                    },
                  ],
                  relations: [],
                  metadata: {},
                  extensions: {},
                },
              ],
              relations: [],
              metadata: {},
              extensions: {},
            },
            metadata: {},
            extensions: {},
          },
          relations: [],
          metadata: {},
          extensions: {},
        },
      ],
      relations: [],
      metadata: {},
      extensions: {},
    },
    metadata: {},
    extensions: {},
  };
}
