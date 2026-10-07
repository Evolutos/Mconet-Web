// Copyright © 2026 Mcont.

import type { OpenIdentifier } from "@evolutos/mconet-core-domain";

import type { ComponentTypeContract } from "./component-type-contract.js";

/**
 * Immutable descriptive metadata published by one runtime component.
 *
 * Name and version support diagnostics and observation but never identify a
 * selectable component. Type-contract and capability facts describe whether an
 * already supplied component can satisfy an execution plan. Source records its
 * ownership tier without introducing a registry key, priority, implementation,
 * lifecycle hook, mutable provider, request data, or runtime selection result.
 */
export interface ComponentDescriptor {
  /** Human-readable component name used only for diagnostics and observation. */
  readonly name: string;

  /** Opaque component implementation version used only as descriptive metadata. */
  readonly version: string;

  /** Optional input and output port identities declared by the component. */
  readonly typeContract?: ComponentTypeContract;

  /** Read-only standard or integration-defined capabilities the component provides. */
  readonly capabilities: ReadonlySet<OpenIdentifier>;

  /** Ownership tier from which the concrete component instance was supplied. */
  readonly source: "builtin" | "plugin" | "application";
}
