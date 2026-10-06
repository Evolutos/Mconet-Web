// Copyright © 2026 Mcont.

/**
 * Runtime-neutral byte sequence shared by browser and Node.js integrations.
 *
 * The alias uses the ECMAScript typed-array contract and does not imply buffer
 * ownership, immutability, copying, encoding, or streaming behavior.
 */
export type Bytes = Uint8Array;
