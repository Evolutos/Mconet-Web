<!-- Copyright © 2026 Mcont. -->

# Unknown Field Preservation

This specification defines how Mconet SDK implementations handle JSON object members that are not declared by the schema version understood by the reader. It preserves safe forward-compatible data without allowing unknown input to change runtime behavior.

## Terms

- A known field is declared at the current object path by the selected schema version.
- An unknown field is a syntactically valid JSON object member that is not declared at that object path.
- A retention point is a schema-declared location that can store unknown members with their original names and JSON values.
- An extension field is data intentionally carried inside a declared `extensions` member.
- A raw payload is an explicitly enabled, size-bounded byte representation used when structured JSON preservation is insufficient.

## Preservation procedure

An implementation that reads a JSON object must perform these steps in order:

1. Parse and validate the JSON representation according to the base serialization conventions.
2. Select the applicable schema version without consulting unknown fields.
3. Partition object members into known and unknown fields by their exact names and object paths.
4. Decode known fields according to the selected schema.
5. Preserve each unknown field only through a retention mechanism explicitly allowed at that object path.
6. Report an error or diagnostic when an unknown field cannot be preserved safely; never discard it silently.

Unknown fields must not be used to infer a schema version, select an adapter or component, choose an authorization mechanism, relax validation, change a resource limit, resolve a reference, or drive any other control flow.

## Structured retention

- A retained unknown field keeps its exact member name and a deep, immutable JSON-value copy.
- The copied value must satisfy the same primitive, collection, and numeric rules as any other `JsonValue`.
- A retained field is associated with its original object path. It must not be moved to a parent, child, or unrelated object.
- A source field must not be moved into a declared `extensions` member unless that schema explicitly defines the mapping.
- Data already inside a declared `extensions` member remains extension data and is preserved under its original extension key.
- Extension data contains values only. It must not contain executable behavior, component instances, dependency-injection keys, credentials, or platform objects.
- Implementations must store member names as own data keys without invoking prototype setters. Names such as `__proto__` and `constructor` remain ordinary JSON keys.

## Round-trip behavior

When a reader supports structured retention at an object path, decoding and re-encoding must preserve:

- the unknown member's exact name;
- its distinction from a missing member;
- explicit `null`, `false`, zero, empty array, and empty object values;
- array element order; and
- a semantically equivalent JSON value after applying the base numeric rules.

Object member order and source whitespace are not part of the retained value semantics. A conforming encoder may change either without losing the unknown field.

If a later schema version declares a previously unknown member, that member is decoded and validated as known data. A stale retained copy must not also be emitted. Any collision between a known field and retained unknown data is an error; implementations must not resolve it by arbitrary overwrite order.

## Raw preservation

Structured JSON retention is preferred. A raw payload may be used only when all of the following are true:

- the caller or host explicitly enabled raw capture;
- the schema or protocol boundary permits raw preservation;
- a positive byte limit is enforced during capture;
- truncation is recorded rather than hidden;
- media type, schema identifier, and metadata are themselves safe to retain; and
- the payload passes the applicable secret and privacy policy.

Core code must not interpret an unknown raw payload as known business data. Raw bytes must not be used for component selection or control flow.

## Unsupported or unsafe fields

An unknown field is not safely preservable when it contains an invalid JSON value, violates numeric limits, exceeds an applicable size limit, conflicts with a known field, targets a path without a permitted retention mechanism, or would violate secret, privacy, or authorization policy.

In that case an implementation must take one explicit action defined by its compatibility policy:

- reject the containing value with a stable error; or
- continue only when the policy permits loss, while emitting a diagnostic that identifies the object path and omitted field without copying sensitive content.

No policy may silently drop the field. Permissive handling must not bypass required capabilities, reference integrity, secret handling, or security validation.

## Examples

Given a schema that declares `name` and permits unknown-member retention at the same object path:

```json
{
  "name": "model-name",
  "futureOption": {
    "enabled": true,
    "threshold": 0
  }
}
```

An older reader decodes `name` as known data and retains `futureOption` with its exact name and JSON value. Re-encoding must still contain a semantically equivalent `futureOption` member.

Given a declared extension container:

```json
{
  "name": "model-name",
  "extensions": {
    "vendor.example/feature": {
      "enabled": true
    }
  }
}
```

The extension key and value remain inside `extensions`. They do not become top-level fields and do not activate behavior unless a component with an explicit, validated contract interprets them.

If the selected schema declares neither retention nor an extension mapping for `futureOption`, the reader must not return only `{ "name": "model-name" }` without an error or diagnostic.

## Conformance requirements

An implementation conforms to this specification only when it:

1. preserves every safely retainable unknown field at its declared retention point;
2. reports every unknown field that cannot be preserved instead of silently losing it;
3. round-trips retained names and JSON values without converting missing, `null`, false, zero, or empty collections into one another;
4. prevents unknown data from affecting component selection, control flow, authorization, validation, limits, or references;
5. keeps extension values and raw payloads within their declared data-only and resource-bounded roles; and
6. rejects or diagnoses collisions and unsafe content without exposing secrets.
