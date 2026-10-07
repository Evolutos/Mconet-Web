// Copyright © 2026 Mcont.

import type { SelectedComponent } from "./selected-component.js";

/**
 * Immutable ordered results of resolving uniquely selected component roles.
 *
 * Every entry represents one role already reduced to one compatible component.
 * The resolver that creates this value must reject duplicate roles, missing
 * required roles, and same-tier ambiguity before construction. Input-dispatched
 * handler or provider candidate lists remain outside this single-role snapshot.
 */
export interface ComponentSelectionResolution {
  /** Ordered snapshots of components selected for unique execution roles. */
  readonly components: readonly SelectedComponent[];
}
