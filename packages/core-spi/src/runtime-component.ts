// Copyright © 2026 Mcont.

import type { ComponentDescriptor } from "./component-descriptor.js";

/**
 * Minimal common contract implemented by replaceable runtime behaviors.
 *
 * The shared surface exposes only immutable descriptive metadata. Concrete SPI
 * roles define their own supported inputs and behavior instead of inheriting a
 * universal execute method. Component identity, lookup, priority, lifecycle,
 * ownership actions, request state, and mutable configuration remain outside
 * this abstraction.
 */
export interface RuntimeComponent {
  /** Descriptive type, capability, and source facts for this concrete component. */
  readonly descriptor: ComponentDescriptor;
}
