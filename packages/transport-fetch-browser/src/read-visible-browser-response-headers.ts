// Copyright © 2026 Mcont.

import type { HeaderField, HeaderFields } from "@evolutos/mconet-core-domain";

/**
 * Header list whose iteration returns only the entries the platform exposes.
 *
 * A browser `Headers` object hides CORS-safelist failures. This source is that
 * iteration, not a lookup of names the caller hoped to see.
 */
export interface VisibleResponseHeaderSource {
  /**
   * Visits each exposed header.
   *
   * @param visit Callback receiving the exposed value and name.
   */
  forEach(visit: (value: string, name: string) => void): void;
}

/**
 * Copies response headers the platform actually exposed.
 *
 * Missing and CORS-hidden headers stay absent. The function does not look up
 * names, invent `Content-Type`, or replace a hidden value with an empty field.
 *
 * @param headers Platform header list restricted to visible entries.
 * @returns Frozen header occurrences in iteration order.
 */
export function readVisibleBrowserResponseHeaders(
  headers: VisibleResponseHeaderSource,
): HeaderFields {
  const fields: HeaderField[] = [];

  headers.forEach((value, name) => {
    fields.push(
      Object.freeze({
        name: name.toLowerCase(),
        value,
      }),
    );
  });

  return Object.freeze(fields);
}
