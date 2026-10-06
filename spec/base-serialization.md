<!-- Copyright © 2026 Mcont. -->

# Base Serialization Conventions

This specification defines the language-neutral JSON representation rules shared by Mconet SDK implementations. A model-specific schema may narrow these rules but must not reinterpret them.

## Optional members

- An absent optional member is encoded by omitting its object key.
- JSON `null` is a present value. It is valid only when the member's declared type explicitly includes `null`.
- `undefined` has no JSON representation. An encoder must not convert it to `null`, an empty value, or another placeholder.
- A present value equal to a documented default remains present and is encoded normally. Generic serialization must not omit it merely because it equals that default.
- A decoder must determine presence before applying a model-specific default. It must not report a defaulted member as having appeared in the source document.
- Missing, explicit `null`, and an explicit default value are three distinct states whenever the declared model permits all three.

Examples:

```json
{}
```

The member is absent.

```json
{ "value": null }
```

The member is present with `null`; the schema must explicitly allow this value.

```json
{ "enabled": false }
```

The member is present even when `false` is its documented default.

## Empty collections

- A present empty array is encoded as `[]`.
- A present empty object or map is encoded as `{}`.
- Empty arrays and objects must not be replaced by `null` or omitted keys.
- An absent collection, an explicit `null` collection, and a present empty collection are distinct states.
- Array element order is preserved exactly, including for an empty or single-element array.
- Whether an empty collection is permitted is determined by the member's schema; the serializer does not invent a minimum size.

Examples:

```json
{ "items": [] }
```

`items` is present and empty. It is not equivalent to `{}` or `{ "items": null }`.

```json
{ "metadata": {} }
```

`metadata` is present and empty. It is not equivalent to an absent `metadata` member.

## JSON numbers

- Runtime numeric values use finite IEEE 754 binary64 semantics.
- `NaN`, positive infinity, and negative infinity are invalid and must be rejected before encoding or after decoding.
- Negative zero is not a canonical domain value and must be rejected where its sign would otherwise be lost during JSON encoding.
- A member declared as an integer accepts only values for which the runtime equivalent of `Number.isSafeInteger` is true.
- The inclusive portable integer range is `-9007199254740991` through `9007199254740991`.
- A member declared as non-negative also rejects negative values after the safe-integer or finite-number check.
- Fractional values are accepted only by members whose model explicitly permits fractions; integer members must not round or truncate them.
- Encoders must emit numbers as JSON numbers, never as locale-formatted text or quoted numeric strings.
- Decoders must not clamp, round, truncate, or wrap an out-of-range value. They must reject it at the trust boundary.
- A JSON number that overflows to a non-finite runtime value is invalid.

Examples:

```json
{ "milliseconds": 0 }
```

Zero is a present numeric value and is not equivalent to an absent member.

```json
{ "count": 9007199254740991 }
```

This is the largest portable positive integer.

```json
{ "count": 9007199254740992 }
```

This value is outside the portable integer range and must be rejected for an integer member.

## Conformance requirements

An implementation conforms to this specification only when it:

1. preserves the distinction between missing, `null`, explicit default, and present empty collection states;
2. rejects unsupported or lossy numeric representations instead of silently coercing them;
3. produces JSON that another conforming implementation can decode with the same declared value semantics; and
4. applies stricter model-specific rules only when the relevant schema or public contract declares them.
