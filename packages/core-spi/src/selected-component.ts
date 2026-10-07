// Copyright © 2026 Mcont.

import type { ComponentDescriptor } from "./component-descriptor.js";
import type { ComponentRole } from "./component-role.js";
import type { RuntimeComponent } from "./runtime-component.js";

/**
 * Immutable snapshot binding one execution role to its selected component.
 *
 * The explicit descriptor records the metadata used during selection while the
 * type-erased RuntimeComponent instance remains available for the execution
 * snapshot. The resolver that creates this value must ensure the descriptor
 * matches the component; this structural contract performs no runtime lookup,
 * registration, cloning, ownership decision, or lifecycle action.
 */
export interface SelectedComponent {
  /** Execution-chain position fulfilled by the selected component. */
  readonly role: ComponentRole;

  /** Type-erased runtime component retained for later execution. */
  readonly component: RuntimeComponent;

  /** Component metadata snapshot used when this selection was resolved. */
  readonly descriptor: ComponentDescriptor;
}
