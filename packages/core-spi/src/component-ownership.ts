// Copyright © 2026 Mcont.

import type { OpenIdentifier } from "@evolutos/mconet-core-domain";

/**
 * Open identity describing who owns one runtime component's lifecycle.
 *
 * Builtin ownership means the SDK created and may close the component;
 * application ownership means an injected component remains caller-managed.
 * Ownership is independent from ComponentDescriptor.source: a plugin describes
 * implementation provenance, while construction and injection determine who is
 * responsible for releasing its resources.
 */
export type ComponentOwnership =
  "builtin" | "application" | (OpenIdentifier & Record<never, never>);
