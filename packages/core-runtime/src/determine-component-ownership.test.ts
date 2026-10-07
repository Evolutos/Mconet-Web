// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it, vi } from "vitest";

import type {
  ComponentOwnership,
  ComponentDescriptor,
  RuntimeComponent,
} from "@evolutos/mconet-core-spi";

import { determineComponentOwnership } from "./determine-component-ownership.js";

it("exposes one explicit identity-membership ownership signature", () => {
  // A labelled readonly input makes construction evidence mandatory and prevents
  // descriptor source or close-method presence from becoming implicit inputs.
  expectTypeOf(determineComponentOwnership).toEqualTypeOf<
    (
      input: Readonly<{
        readonly component: RuntimeComponent;
        readonly sdkCreatedComponents: ReadonlySet<RuntimeComponent>;
      }>,
    ) => ComponentOwnership
  >();
});

it("marks an SDK-created component as builtin-owned", () => {
  const component = createComponent("sdk-transport", "builtin");
  const sdkCreatedComponents = new Set<RuntimeComponent>([component]);

  // The composition root's identity record is sufficient evidence that a later
  // Client close operation may release this concrete instance.
  expect(determineComponentOwnership({ component, sdkCreatedComponents })).toBe("builtin");
  expect(sdkCreatedComponents).toEqual(new Set([component]));
});

it("marks every unrecorded component as application-owned", () => {
  const applicationComponent = createComponent("injected-transport", "application");
  const pluginComponent = createComponent("injected-plugin", "plugin");
  const builtinDescribedComponent = createComponent("injected-builtin", "builtin");
  const sdkCreatedComponents = new Set<RuntimeComponent>();

  // Absence is intentionally fail-safe: injected resources remain caller-owned
  // regardless of the provenance label published by their descriptors.
  expect(
    determineComponentOwnership({ component: applicationComponent, sdkCreatedComponents }),
  ).toBe("application");
  expect(determineComponentOwnership({ component: pluginComponent, sdkCreatedComponents })).toBe(
    "application",
  );
  expect(
    determineComponentOwnership({ component: builtinDescribedComponent, sdkCreatedComponents }),
  ).toBe("application");
});

it("uses component identity instead of equivalent descriptor metadata", () => {
  const sharedDescriptor = createDescriptor("shared", "plugin");
  const sdkComponent: RuntimeComponent = { descriptor: sharedDescriptor };
  const injectedComponent: RuntimeComponent = { descriptor: sharedDescriptor };
  const sdkCreatedComponents = new Set<RuntimeComponent>([sdkComponent]);

  // Sharing an immutable descriptor does not share construction responsibility;
  // only the exact recorded component instance receives builtin ownership.
  expect(determineComponentOwnership({ component: sdkComponent, sdkCreatedComponents })).toBe(
    "builtin",
  );
  expect(determineComponentOwnership({ component: injectedComponent, sdkCreatedComponents })).toBe(
    "application",
  );
});

it("does not inspect descriptors or execute close-like component behavior", () => {
  const close = vi.fn<() => Promise<void>>();
  const component = {
    get descriptor(): never {
      // Ownership evidence is external to the component, so even a descriptor
      // getter that cannot be read must not affect identity classification.
      throw new Error("descriptor must not be read during ownership determination");
    },
    close,
  };
  const sdkCreatedComponents = new Set<RuntimeComponent>([component]);

  expect(determineComponentOwnership({ component, sdkCreatedComponents })).toBe("builtin");

  // Determination records no lifecycle transition and performs no cleanup. A
  // later Client close policy consumes the returned identity and remains solely
  // responsible for invoking an applicable close contract.
  expect(close).not.toHaveBeenCalled();
  expect(sdkCreatedComponents.has(component)).toBe(true);
});

/** Creates one inert component with independently selectable provenance metadata. */
function createComponent(name: string, source: ComponentDescriptor["source"]): RuntimeComponent {
  // The helper must treat this descriptor as opaque; varying source values lets
  // the tests prove provenance never substitutes for construction evidence.
  return { descriptor: createDescriptor(name, source) };
}

/** Creates immutable descriptive metadata without lifecycle behavior. */
function createDescriptor(
  name: string,
  source: ComponentDescriptor["source"],
): ComponentDescriptor {
  // A fresh empty capability set keeps fixture behavior inert while preserving
  // the complete public descriptor shape expected by RuntimeComponent.
  return {
    name,
    version: "1.0.0",
    capabilities: new Set(),
    source,
  };
}
