// Copyright © 2026 Mcont.

/**
 * Extensible identifier used where applications and integrations may introduce
 * names outside the SDK's built-in vocabulary.
 *
 * This alias intentionally preserves ordinary string assignability. Data from
 * JSON, URLs, storage, or the network still requires runtime validation at its
 * trust boundary; the type alone does not claim that validation has occurred.
 */
export type OpenIdentifier = string;
