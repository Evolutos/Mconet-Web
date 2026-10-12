# Public API review

The public API report is generated from the named exports of every `packages/*/src/index.ts` entry. This review accepts that generated surface.

The accepted packages are `auth-basic`, `client`, `codec-json`, `core-domain`, `core-runtime`, `core-spi`, `integration-openai-compatible`, `testing`, `transport-fetch-browser`, `transport-fetch-node`, and `transport-fetch-shared`.

A new or removed export fails `node scripts/report-public-api.mjs --check` until the report is regenerated and this review is updated. The client browser and node entries export the same names as the client default entry; their Fetch binding differs, and that difference is not a second name set.
