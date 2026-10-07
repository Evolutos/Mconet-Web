// Copyright © 2026 Mcont.

import type { ComponentOwnership, RuntimeComponent } from "@evolutos/mconet-core-spi";

/**
 * Determines lifecycle ownership from explicit SDK construction records.
 *
 * The composition root records every component instance it creates. Identity
 * membership in that collection is the only fact that grants builtin ownership;
 * every unrecorded instance remains application-owned. The helper deliberately
 * ignores descriptor provenance and disposable-looking methods because neither
 * proves who constructed the concrete resource.
 *
 * @param input Component identity and the SDK-created identity collection.
 * @returns `builtin` only for a recorded SDK-created instance; otherwise `application`.
 */
export function determineComponentOwnership(
  input: Readonly<{
    readonly component: RuntimeComponent;
    readonly sdkCreatedComponents: ReadonlySet<RuntimeComponent>;
  }>,
): ComponentOwnership {
  // Set membership uses object identity, so equal metadata cannot transfer SDK
  // lifecycle responsibility to a separately constructed injected component.
  return input.sdkCreatedComponents.has(input.component) ? "builtin" : "application";
}
