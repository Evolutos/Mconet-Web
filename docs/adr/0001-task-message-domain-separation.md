<!-- Copyright © 2026 Mcont. -->

# ADR 0001: Separate Task and Message Domains

- Status: Accepted
- Decision date: 2026-10-06
- Scope: `@evolutos/mconet-core-domain` and every package that consumes its public contracts
- Owner: Mcont

## Context

Mconet must represent more than conversational text. A model interaction can describe generation, embedding, reranking, media processing, or a future task that has no messages at all. Conversation is therefore one task input form, not the universal request model.

Task and Message also change for different reasons:

- Task describes what the caller asks the model to do, including the task type, input and output contracts, generation parameters, tool definitions, and response constraints.
- Message describes ordered communication content, including roles, entries, groups, relations, and content parts.
- Protocol integrations translate both domains into provider-specific payloads, but provider payload structure is not a domain model.
- Access, endpoint, authorization, transport, and runtime execution settings belong to other domains.

If Task and Message share a semantic base or if `ModelRequest` promotes message fields directly, conversation-specific assumptions spread into every future task. Conversely, putting task parameters or provider fields inside messages makes message documents impossible to reuse as protocol-neutral input, output, or context.

## Decision

Task and Message are separate domain models. They may compose through an explicit, directional boundary, but they do not inherit from or alias one another.

The authoritative relationship is:

```text
ModelRequest
└── ModelTaskRequest
    └── TaskDocument
        └── ConversationInputNode
            └── MessageDocument
```

`ModelRequest` is a task-neutral envelope. It contains a task request and must not expose `messages`, `prompt`, generation parameters, or tool definitions as top-level shortcuts.

`ConversationInputNode` is the sole conversation-specific composition point in the initial domain model. It is a Task leaf because it supplies input to a Task, and its `messages` property references a complete `MessageDocument`.

## Domain ownership

### Task owns execution intent

The Task domain owns:

- task descriptors and versioned task identifiers;
- task documents, task nodes, and task relations;
- task-specific input nodes, including the conversation input node;
- generation parameters, tool definitions, and response constraints;
- task request and task result contracts;
- validation and schemas for Task structures.

A Task answers “what operation is requested, with which task-level configuration and input/output contract?”

### Message owns communication content

The Message domain owns:

- message roles;
- message content kinds and content values;
- message entries, groups, and relations;
- message document purpose and version;
- ordering and identity rules within a Message document;
- validation and schemas for Message structures.

A Message document answers “what ordered communication content is being represented?” It does not decide how a model should execute a task.

### Other domains remain external

Neither Task nor Message owns:

- service endpoints or model-provider routing;
- credentials, authorization headers, or secret sources;
- wire formats, HTTP metadata, or transport behavior;
- retry, cancellation, deadline, or runtime component selection;
- provider-specific request and response fields.

Artifacts remain a separate data domain. Task requests may reference an `ArtifactCatalog`, and Message content may refer to catalog-local artifact identifiers through an explicit content type, but neither relationship creates shared Task/Message inheritance.

## Dependency rules

The dependency direction is fixed:

```text
foundational value contracts ← Message
foundational value contracts ← Task
Message ← conversation-specific Task input
Task + Message ← protocol integration
```

The following rules are mandatory:

1. Message modules may depend only on lower-level domain primitives such as open identifiers, JSON values, extensions, and bounded raw payloads.
2. Message modules must not import Task, ModelRequest, Access, Runtime, Adapter, Codec, Transport, Authorization, or provider integration modules.
3. Task modules may import `MessageDocument` only where a task node explicitly composes conversational input.
4. Task and Message must not share a semantic element, node, document, content, or relation base interface.
5. Structurally repeated fields such as `id`, `metadata`, and `extensions` remain independently declared on each domain's internal base contract.
6. Protocol integrations may read Task and Message contracts and map them to wire payloads; they must not add provider fields to either domain.
7. Transport modules must not import Task or Message contracts.
8. Convenience builders may reduce construction boilerplate but must produce the same separated contracts and enter the same runtime pipeline.

These rules apply even while both domains are physically published from `@evolutos/mconet-core-domain`. Package co-location does not erase module ownership or permit circular imports.

## Structural invariants

Implementations and validators must preserve these invariants:

- A `MessageEntry` is a leaf in the Message element tree.
- A message entry's `content` is an ordered content collection, not child Message elements.
- A `MessageDocument` has a Message-owned root and cannot use a Task node as that root.
- A `TaskDocument` has a Task-owned root and cannot use a Message group as that root.
- A conversation Task references a complete `MessageDocument`; it does not copy message entries into the Task tree.
- Task relations target Task node identifiers, while Message relations target Message element identifiers.
- IDs need only be unique within the validation scope defined by their own document; cross-domain ID equality does not imply identity.
- Unknown Task nodes and unknown Message content retain data only within their own forward-compatibility boundaries.

## Correct composition example

The following sketch is illustrative; the public types are introduced by their dedicated implementation steps:

```ts
const request = {
  target,
  task: {
    descriptor: { type: "conversation.generate" },
    document: {
      root: {
        kind: "task.root",
        composition: "container",
        children: [
          {
            kind: "task.input.conversation",
            composition: "leaf",
            messages: messageDocument,
          },
          generationParametersNode,
        ],
      },
    },
    artifacts,
  },
};
```

The message document contains roles and ordered content. The sibling Task node contains generation parameters. The adapter sees both only after the request has passed domain validation.

## Rejected structures

The following shapes violate this decision:

```ts
// Rejected: it makes every model request conversational.
interface ModelRequest {
  readonly messages: readonly MessageEntry[];
}

// Rejected: execution policy is not communication content.
interface MessageEntry {
  readonly temperature?: number;
  readonly tools?: readonly ToolDefinition[];
}

// Rejected: the shared base erases domain-specific tree semantics.
interface DomainNode {
  readonly children?: readonly DomainNode[];
}

interface TaskNode extends DomainNode {}
interface MessageElement extends DomainNode {}

// Rejected: provider and access data do not belong to Message.
interface MessageDocument {
  readonly endpoint: URL;
  readonly apiKey: string;
  readonly providerPayload: unknown;
}
```

## Rationale

The separation provides these properties:

- Non-conversation tasks can reuse `ModelRequest` and the runtime without manufacturing fake messages.
- Message documents can be reused as input, output, or context without acquiring task execution policy.
- Task-specific validation can reject unsupported operations before credentials are read or network I/O begins.
- Protocol integrations have one explicit translation boundary instead of leaking provider concepts into shared data.
- Message and Task can evolve independently while their narrow composition point remains reviewable.
- Type narrowing reflects the correct domain, rather than a permissive shared tree whose legal combinations are only documented informally.

## Alternatives considered

### Make Message the universal request

This would simplify the first text-only example but would require embeddings, reranking, and media tasks to invent conversational wrappers. It was rejected because it contradicts the task-neutral request envelope.

### Put Task configuration on Message entries

This would place generation parameters and tools near conversational content. It was rejected because entry ordering and content semantics are unrelated to execution configuration, and repeated per-message configuration creates ambiguous precedence.

### Use one generic recursive node tree

This would reduce repeated structural fields. It was rejected because it permits invalid cross-domain children, couples two evolution paths, and forces validators to reconstruct domain boundaries at runtime.

### Keep Task and Message completely unaware of each other

This would require an adapter-only side channel to associate a conversation with a task. It was rejected because the task input contract should explicitly and portably reference its Message document. The accepted design uses one directional, typed composition point instead.

## Consequences

Positive consequences:

- domain ownership and dependency direction are mechanically reviewable;
- future task types do not need Message dependencies;
- Message validators and fixtures remain provider- and execution-neutral;
- protocol adapters receive explicit structured inputs;
- accidental credential or provider-field leakage into Message is easier to detect.

Costs and trade-offs:

- some structural fields are intentionally duplicated between Task and Message bases;
- conversation construction is more verbose than a top-level `messages` shortcut;
- builders and examples must teach the composition boundary;
- tests must cover both independent domain validation and composed conversation validation.

The duplication is accepted because these fields share representation, not meaning. Convenience APIs may hide construction ceremony, but they may not change the underlying contracts.

## Enforcement and review

This ADR is satisfied only when all applicable checks pass:

- Message source files contain no imports from Task, Request, Access, Runtime, SPI, transport, authorization, or integration modules.
- `MessageElementBase` and `TaskNodeBase` are distinct internal contracts with no shared semantic base.
- `ConversationInputNode` references `MessageDocument` and introduces no copied Message fields.
- `ModelRequest` contains a task request rather than top-level messages or task parameters.
- Message validators reject Task, access, protocol, and provider fields when schemas are closed for those structures.
- Task and Message type-level tests prove that their roots, nodes, relations, and content cannot be interchanged.
- dependency-boundary checks reject reverse Message-to-Task imports and Transport imports from either domain.
- scope validation rejects unsupported Task and Message content before credential resolution and network I/O.

Any proposal to add a shared semantic base, move task configuration into Message, promote messages onto `ModelRequest`, or reverse the dependency direction requires a new ADR that supersedes this decision.
