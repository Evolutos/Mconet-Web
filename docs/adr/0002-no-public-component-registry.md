<!-- Copyright © 2026 Mcont. -->

# ADR 0002: Use Explicit Component Composition Without a Public Registry

- Status: Accepted
- Decision date: 2026-10-06
- Scope: component configuration, integration resolution, runtime selection, and package initialization
- Owner: Mcont

## Context

Mconet composes protocol adapters, codecs, transports, authorization handlers, access resolvers, monitors, and model integrations. Applications also need to replace selected components at Client or interaction scope.

A conventional plugin Registry would expose operations such as `register`, `unregister`, or `resolve(componentId)`. If that Registry is global or mutable after Client construction, behavior depends on import order, concurrent writes, test order, and hidden process state. String component IDs also create a second, weakly typed configuration language alongside TypeScript interfaces.

These risks are especially costly in browser, Worker, SSR, and concurrent server environments:

- top-level registration side effects keep otherwise unused integrations in bundles;
- the same import graph can behave differently because registration order changed;
- one request or tenant can mutate component selection for another;
- a registration race can change behavior after validation but before I/O;
- unregistering a component creates unclear ownership and in-flight request semantics;
- tests must reset hidden global state and can still leak configuration between cases;
- SSR module caches can accidentally share request-specific components or credentials.

Mconet requires extensibility, but extensibility does not require a public mutable Registry.

## Decision

Mconet will not expose a public component Registry, public component IDs, dynamic binding registration, unregister operations, or runtime plugin hot loading.

Applications compose concrete, typed component instances at an explicit composition root. The instances are passed through Client configuration or interaction options. Default factories may assemble reviewed SDK components internally, and integrations may supply explicit component instances, but no layer mutates a shared registry.

The selection model is:

```text
explicit typed instances
→ deterministic precedence
→ plan and contract validation
→ immutable per-interaction execution snapshot
→ execution
```

## Explicit composition boundary

The public configuration shape groups optional concrete instances by their SPI role. The following sketch is illustrative; each public type is introduced in its own implementation step:

```ts
interface RuntimeComponents {
  readonly modelIntegrationResolver?: ModelIntegrationResolver;
  readonly taskProtocolAdapter?: TaskProtocolAdapter;
  readonly serviceAccessResolver?: ServiceAccessResolver;
  readonly payloadEncoder?: PayloadEncoder;
  readonly successPayloadDecoder?: PayloadDecoder;
  readonly errorPayloadDecoder?: PayloadDecoder;
  readonly transport?: Transport;
  readonly authorizationHandlerResolver?: AuthorizationHandlerResolver;
  readonly authorizationHandlers?: readonly AuthorizationHandler[];
}
```

Applications can create components directly or use an external dependency-injection container to construct them. The SDK boundary still receives typed instances, not container handles, string keys, constructors to discover, or callbacks that mutate SDK-global state.

The term “plugin” means an independently importable package or application-supplied composition that implements a reviewed SPI. Installing or importing a plugin does not activate it. Activation occurs only when its instance is explicitly passed to a factory, Client, or interaction.

## Deterministic precedence

For every single-value component role, selection uses this fixed precedence:

```text
InteractionOptions instance
> ModelClientConfiguration instance
> current Integration/Plugin instance
> SDK default instance
```

Selection and validation are separate operations:

1. choose the first present instance by precedence;
2. validate it against the protocol execution plan;
3. validate adjacent component type contracts;
4. validate every required capability;
5. freeze the accepted component in the interaction execution snapshot.

An explicitly supplied component is the caller's final choice for that role. If it is incompatible, selection fails before credentials are read or network I/O begins. The runtime must not silently fall back to a lower-priority component.

This behavior prevents a typo or incompatible override from appearing to work while a different component actually executes.

## Multi-value roles

A role that legitimately accepts candidates, such as authorization handlers, uses an explicit readonly list plus a typed resolver. It is not a Registry.

Candidate resolution must have deterministic `none`, `one`, and `many` outcomes:

- no compatible candidate produces the stable unsupported or missing-component error for that role;
- exactly one compatible candidate is selected;
- more than one equally valid candidate produces an ambiguity error;
- array order is used only when the resolver contract explicitly defines ordered responsibility-chain semantics;
- candidates cannot be added, removed, or reordered after the Client snapshot is created.

The SDK does not expose candidate lookup by arbitrary public string ID. Diagnostic component identity may be reported through immutable component metadata, but metadata does not create a registration API.

## Integration resolution

Model integration selection uses an injected `ModelIntegrationResolver`. Its minimum input is:

```text
ModelTarget + TaskDescriptor + InteractionMode
```

The default resolver may use an internal immutable Type table keyed by:

```text
protocolId + task.type + mode
```

It may add reviewed dimensions such as `serviceId`, `model.family`, or `deploymentId` when needed for explicit specificity. It must not guess from model names or endpoint strings.

The internal Type table is allowed because it differs from a public Registry in every material property:

- it is built by a factory from a finite, explicit input set;
- it is immutable after construction;
- its key and binding types are internal implementation details;
- duplicate keys fail during factory initialization;
- resolution returns exactly one plan or a stable none/ambiguous error;
- callers cannot mutate it through registration APIs.

An application that needs different resolution logic injects another `ModelIntegrationResolver` instance. It does not append bindings to SDK-global state.

## Immutability and request isolation

Client construction resolves its defaults into immutable configuration. Each interaction then creates a separate resolved configuration and `InteractionExecutionComponents` snapshot.

The following rules apply:

- interaction overrides never write back to Client configuration;
- Client configuration never writes back to SDK defaults;
- component selection completes before request encoding, credential access, or network I/O;
- selected components cannot change during an interaction;
- request-local signal, deadline, access, credentials, and monitoring state are never stored in reusable component registries;
- concurrent interactions may reuse explicitly documented stateless components, but do not share mutable request state;
- closing a Client does not mutate configuration used by another Client.

## Module initialization and tree-shaking

Package imports must not register components or alter SDK behavior. Root entries and plugin entries are side-effect-free unless a narrowly scoped file explicitly documents an unavoidable non-registration side effect.

Allowed illustrative composition:

```ts
const client = createModelClient({
  components: {
    modelIntegrationResolver,
    transport,
  },
});
```

Rejected:

```ts
// Rejected: importing a module must not mutate component availability.
import "@evolutos/mconet-integration-openai-compatible/register";

// Rejected: public string IDs are an untyped service locator.
registry.register("transport", fetchTransport);
const transport = registry.resolve("transport");

// Rejected: a request must not alter other requests or Clients.
client.components.register(customCodec);
```

This rule preserves tree-shaking: an unused integration package remains absent from the application bundle, and importing one integration does not pull every other integration into the root entry.

## Component ownership and lifecycle

Explicit composition makes ownership visible:

- components created by an SDK default factory are SDK-owned;
- components passed by the application are application-owned;
- `ModelClient.close()` releases only SDK-owned resources;
- application-owned components are not closed, unregistered, or mutated by the SDK;
- request-scoped resources are released by the interaction that created them;
- a reusable resolver or transport must document whether it is stateless or owns resources.

The ownership rule is determined when components are composed, not inferred later from a Registry entry or component ID.

## Extension path

New capabilities follow this order:

```text
open data representation
→ explicit Adapter or plugin composition
→ direct injection through an existing SPI
→ reviewed, versioned Core SPI change
```

A new component need not be added to an SDK Registry. If an existing SPI expresses the capability, the application imports the implementation and passes an instance. If no SPI can express it safely, the SPI is changed through normal architecture and version review rather than bypassed with a generic registration hook.

## Rejected alternatives

### Process-global mutable Registry

Rejected because behavior would depend on hidden state, import order, test cleanup, and cross-request mutation. It is unsafe for concurrent SSR and multi-tenant processes.

### Mutable Registry per Client

This reduces global leakage but still allows selection to change while requests are in flight, complicates ownership, and makes Client behavior time-dependent. Immutable Client configuration plus per-interaction overrides provides the required flexibility without mutation.

### Public string component IDs

Rejected because IDs duplicate TypeScript SPI types with a weakly typed lookup layer, move errors to runtime, encourage name collisions, and invite arbitrary configuration-driven code selection.

### Import-time auto-registration

Rejected because it relies on side effects, prevents reliable tree-shaking, changes behavior with bundler ordering, and can pull unrelated provider code into browser bundles.

### Runtime plugin discovery or hot loading

Rejected for the current functional scope because it requires a trust model, lifecycle management, asynchronous discovery, compatibility negotiation, and failure semantics that are outside the text-unary scope. Explicit dynamic `import()` followed by instance injection remains an application concern, subject to the same immutable composition boundary.

### Silent fallback after incompatible override

Rejected because it hides configuration defects and can execute a different codec, transport, or authorization strategy than the caller selected.

## Consequences

Positive consequences:

- selection is deterministic from explicit input values;
- Client and interaction behavior can be tested without resetting global state;
- concurrent requests and SSR tenants cannot register components into one another;
- package imports remain side-effect-free and tree-shakeable;
- component ownership and close behavior are knowable at composition time;
- TypeScript interfaces remain the extension contract;
- incompatible overrides fail before Secret access and I/O.

Costs and trade-offs:

- applications must retain and pass component instances explicitly;
- composition roots are more verbose than importing a self-registering plugin;
- default factories must declare their built-in integrations and components;
- immutable Type tables must be rebuilt to change their finite binding set;
- external configuration cannot select arbitrary executable code by ID without an application-owned mapping layer.

These costs are accepted because composition is security- and behavior-relevant and should remain visible in application code.

## Enforcement and review

This ADR is satisfied only when all applicable checks pass:

- public exports contain no `Registry`, `register`, `unregister`, component-ID lookup, or mutable binding API;
- package root imports do not change component availability or mutate shared state;
- package manifests declare correct side-effect metadata and packaging tests prove unused integrations can be excluded;
- single-value selection follows Interaction > Client > Integration/Plugin > SDK Default;
- an incompatible explicit instance fails without lower-priority fallback;
- default integration bindings are immutable and duplicate keys fail at factory initialization;
- resolver Contract Suites cover exact, none, and ambiguous outcomes;
- interaction snapshots are immutable and concurrent tests prove request isolation;
- direct Adapter injection bypasses the default integration resolver but still passes support, plan, type-contract, and capability validation;
- application-owned components are not closed or mutated by the SDK;
- no credential, request body, signal, deadline, or request-local state is stored in reusable selection data.

Any proposal to add a public Registry, registration side effect, component-ID service locator, mutable Client binding set, or fallback after an incompatible explicit override requires a new ADR that supersedes this decision.
