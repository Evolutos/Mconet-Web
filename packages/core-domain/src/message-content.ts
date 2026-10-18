// Copyright © 2026 Mcont.

import type { ArtifactMessageContent } from "./artifact-message-content.js";
import type { TextMessageContent } from "./text-message-content.js";
import type { UnknownMessageContent } from "./unknown-message-content.js";

/**
 * Immutable message content supported by the current public domain model.
 *
 * Text and artifact references have typed payloads. Unknown preserves every
 * other standard, integration-defined, or future kind without semantic
 * coercion. Consumers narrow a member by its required payload (`text` or
 * `artifactId`) rather than kind equality alone.
 */
export type MessageContent = TextMessageContent | ArtifactMessageContent | UnknownMessageContent;
