// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import { ModelInteractionError } from "@evolutos/mconet-core-domain";
import type { ComponentRole, RuntimeComponent } from "@evolutos/mconet-core-spi";

import { resolveSingleComponent } from "./resolve-single-component.js";

const role: ComponentRole = { id: "payload.encoder" };

it("exposes one generic fixed-precedence selection signature", () => {
  // The labelled readonly input separates the four tiers and prevents callers
  // from supplying an arbitrary sortable candidate list or custom priority.
  expectTypeOf(resolveSingleComponent).toEqualTypeOf<
    <Component extends RuntimeComponent>(
      input: Readonly<{
        readonly role: ComponentRole;
        readonly interactionComponent?: Component;
        readonly clientComponent?: Component;
        readonly integrationComponents: readonly Component[];
        readonly sdkDefaultComponent?: Component;
      }>,
    ) => Component
  >();
});

it("selects the interaction component without inspecting lower tiers", () => {
  const interactionComponent = createComponent("interaction");
  const clientComponent = createComponent("client");
  const firstIntegration = createComponent("integration-first");
  const secondIntegration = createComponent("integration-second");
  const sdkDefaultComponent = createComponent("sdk-default");
  const integrationComponents = [firstIntegration, secondIntegration] as const;
  const input = {
    role,
    interactionComponent,
    clientComponent,
    integrationComponents,
    sdkDefaultComponent,
  } as const;

  // A higher direct choice intentionally masks same-tier ambiguity below it;
  // compatibility validation of that explicit choice is a separate step.
  expect(resolveSingleComponent(input)).toBe(interactionComponent);
  expect(input.integrationComponents).toBe(integrationComponents);
});

it("selects the client component before integration and the SDK default", () => {
  const clientComponent = createComponent("client");
  const integrationComponent = createComponent("integration");
  const sdkDefaultComponent = createComponent("sdk-default");

  // Absence at the interaction tier exposes the Client's direct final choice;
  // lower sources remain untouched and cannot silently replace it.
  expect(
    resolveSingleComponent({
      role,
      clientComponent,
      integrationComponents: [integrationComponent],
      sdkDefaultComponent,
    }),
  ).toBe(clientComponent);
});

it("selects one integration candidate before the SDK default", () => {
  const integrationComponent = createComponent("integration");
  const sdkDefaultComponent = createComponent("sdk-default");

  // Exactly one candidate makes the integration tier deterministic without
  // descriptor names, candidate sorting, or hidden registration priority.
  expect(
    resolveSingleComponent({
      role,
      integrationComponents: [integrationComponent],
      sdkDefaultComponent,
    }),
  ).toBe(integrationComponent);
});

it("uses the SDK default only when every higher tier is absent", () => {
  const sdkDefaultComponent = createComponent("sdk-default");

  // The default is a concrete final fallback, not a registry search or a value
  // that can override any explicitly supplied component.
  expect(resolveSingleComponent({ role, integrationComponents: [], sdkDefaultComponent })).toBe(
    sdkDefaultComponent,
  );
});

it("reports an ambiguous integration tier without choosing by order", () => {
  const first = createComponent("first");
  const second = createComponent("second");
  const candidates = [first, second] as const;
  const error = captureInteractionError(() => {
    // No higher direct choice exists, so both same-tier matches must be rejected
    // before the lower SDK default can be considered.
    resolveSingleComponent({
      role,
      integrationComponents: candidates,
      sdkDefaultComponent: createComponent("sdk-default"),
    });
  });

  expect(error).toMatchObject({
    category: "invalid_component_configuration",
    phase: "resolution",
    code: "ambiguous_component_selection",
    diagnostics: [
      {
        code: "ambiguous_component_selection",
        severity: "error",
        phase: "resolution",
        details: { roleId: role.id, candidateCount: 2 },
      },
    ],
  });
  expect(candidates).toEqual([first, second]);
});

it("reports a missing component with stable role context", () => {
  const error = captureInteractionError(() => {
    // Every tier is absent, so resolution fails before any execution stage can
    // acquire credentials, encode data, or perform network I/O.
    resolveSingleComponent({ role, integrationComponents: [] });
  });

  expect(error).toMatchObject({
    category: "invalid_component_configuration",
    phase: "resolution",
    code: "component_not_found",
    diagnostics: [
      {
        code: "component_not_found",
        severity: "error",
        phase: "resolution",
        details: { roleId: role.id },
      },
    ],
  });
});

it("returns a selected component without reading its descriptor", () => {
  const selected: RuntimeComponent = {
    get descriptor(): never {
      // Descriptor compatibility belongs to later type and capability checks;
      // selection by explicit tier must preserve the opaque component instance.
      throw new Error("descriptor must not be read during priority selection");
    },
  };

  expect(
    resolveSingleComponent({ role, interactionComponent: selected, integrationComponents: [] }),
  ).toBe(selected);
});

/** Creates one inert component identity for precedence and ambiguity tests. */
function createComponent(name: string): RuntimeComponent {
  // Only descriptor metadata is required; the fixed selection algorithm neither
  // invokes behavior nor uses names, versions, capabilities, or source to rank.
  return {
    descriptor: {
      name,
      version: "1.0.0",
      capabilities: new Set(),
      source: "application",
    },
  };
}

/** Captures the expected classified resolution failure without an unsafe cast. */
function captureInteractionError(action: () => void): ModelInteractionError {
  try {
    // Invoke exactly once so candidate order and error allocation remain easy to
    // reason about in every negative test.
    action();
  } catch (error) {
    if (error instanceof ModelInteractionError) {
      return error;
    }
    // Preserve an unexpected failure as the cause of a test-only assertion error
    // rather than hiding it behind a type assertion.
    throw new Error("Expected ModelInteractionError.", { cause: error });
  }

  throw new Error("Expected component resolution to fail.");
}
