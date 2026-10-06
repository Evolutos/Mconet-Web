# Package Naming Convention

> Copyright © 2026 Mcont. All rights reserved.

## Purpose

This document defines the single naming convention for every package in the Mconet Web workspace. It is a naming specification only; package directories and manifests are created by later implementation steps.

## Public package namespace

All publishable packages must use the npm scope `@evolutos` and the project prefix `mconet-`:

```text
@evolutos/mconet-<package-role>
```

A valid publishable package name must match:

```regex
^@evolutos/mconet-[a-z0-9]+(?:-[a-z0-9]+)*$
```

The package role must:

- use lowercase ASCII letters and digits;
- separate semantic segments with a single hyphen;
- describe one architectural responsibility;
- avoid runtime version numbers, release channels, and implementation codenames;
- avoid generic names that do not communicate the package boundary.

## Workspace directory mapping

Package directories use the package role without the npm scope or `mconet-` prefix:

```text
packages/<package-role> → @evolutos/mconet-<package-role>
```

Examples:

| Workspace directory                      | Package name                                     |
| ---------------------------------------- | ------------------------------------------------ |
| `packages/core-domain`                   | `@evolutos/mconet-core-domain`                   |
| `packages/core-spi`                      | `@evolutos/mconet-core-spi`                      |
| `packages/core-runtime`                  | `@evolutos/mconet-core-runtime`                  |
| `packages/codec-json`                    | `@evolutos/mconet-codec-json`                    |
| `packages/auth-basic`                    | `@evolutos/mconet-auth-basic`                    |
| `packages/transport-fetch-browser`       | `@evolutos/mconet-transport-fetch-browser`       |
| `packages/transport-fetch-node`          | `@evolutos/mconet-transport-fetch-node`          |
| `packages/integration-openai-compatible` | `@evolutos/mconet-integration-openai-compatible` |
| `packages/client`                        | `@evolutos/mconet-client`                        |
| `packages/testing`                       | `@evolutos/mconet-testing`                       |

## Example package names

Runnable examples are private workspace packages. Their names use the same npm scope and an explicit `mconet-example-` prefix:

```text
examples/<scenario> → @evolutos/mconet-example-<scenario>
```

A valid example package name must match:

```regex
^@evolutos/mconet-example-[a-z0-9]+(?:-[a-z0-9]+)*$
```

Example packages must set `private: true` and must never be published.

## Root package exception

The workspace root keeps the private name `mconet-web`. It is an aggregation project rather than a publishable SDK package, so it is the only exception to the scoped package-name rule.

## Import boundary

Consumers must import from package names or explicitly exported subpaths. Imports that reach into another package's source directory are not allowed:

```text
Allowed:     @evolutos/mconet-core-domain
Allowed:     @evolutos/mconet-core-domain/model
Disallowed:  ../../core-domain/src/model/internal-value.js
```

Each package controls its public subpaths through its own `exports` map. A directory name does not create a public import path by itself.
