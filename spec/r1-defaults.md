# R1 defaults

These are the values used when a caller does not supply an override.

| Default                      | Value        |
| ---------------------------- | ------------ |
| Compatibility mode           | `compatible` |
| `maxResponseBodyBytes`       | 16777216     |
| `maxStreamingErrorBodyBytes` | 1048576      |
| `maxFrameBytes`              | 2097152      |

The compatibility mode comes from `createDefaultCompatibilityPolicy`. The byte limits are the client composition-root limits.
