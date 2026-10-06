// Copyright © 2026 Mcont.

import type { Extensions } from "./extensions.js";
import type { JsonValue } from "./json-value.js";
import type { MessageGroup } from "./message-group.js";
import type { OpenIdentifier } from "./open-identifier.js";

/**
 * Immutable, versioned root envelope for one Message-domain tree.
 *
 * Purpose describes input, output, context, or an integration-defined use. The
 * root is always a MessageGroup so a document cannot replace its container with
 * a leaf entry. This neutral envelope contains no task parameters, model target,
 * service access, authorization, protocol payload, or execution behavior.
 */
export interface MessageDocument {
  /** Message schema version interpreted by validators and mappers. */
  readonly version: string;

  /** Standard or integration-defined reason this document exists. */
  readonly purpose: "input" | "output" | "context" | (OpenIdentifier & Record<never, never>);

  /** Required container at the root of the ordered Message tree. */
  readonly root: MessageGroup;

  /** Always-present JSON-compatible document metadata. */
  readonly metadata: Readonly<Record<string, JsonValue>>;

  /** Always-present namespaced extensions for forward-compatible data. */
  readonly extensions: Extensions;
}
