// Copyright © 2026 Mcont.

/**
 * Immutable media type separated into its registration tree and parameters.
 *
 * The top-level type and subtype remain separate so consumers can compare the
 * semantic parts without reparsing a combined string. Parameter names map to
 * their decoded string values. Untrusted strings must use the dedicated parser,
 * which owns syntax validation, case normalization, and quoted-string handling.
 */
export interface MediaType {
  /** Normalized top-level type, such as `application` or `text`. */
  readonly type: string;

  /** Normalized subtype, including any structured suffix such as `problem+json`. */
  readonly subtype: string;

  /** Normalized parameter names mapped to their decoded string values. */
  readonly parameters: Readonly<Record<string, string>>;
}

/** Characters permitted in an HTTP token. */
const tokenCharacter = /^[!#$%&'*+\-.^_`|~A-Za-z0-9]$/u;

/**
 * Parses one HTTP media type into normalized structural components.
 *
 * Top-level type, subtype, and parameter names are normalized to lowercase.
 * Token parameter values preserve their spelling; quoted values are unquoted
 * and quoted-pair escapes are decoded. Invalid or ambiguous input, including
 * duplicate parameter names, returns `undefined`.
 *
 * @param input Untrusted value containing one media type.
 * @returns Parsed media type, or `undefined` when the input is invalid.
 */
export function parseMediaType(input: unknown): MediaType | undefined {
  // Refuse coercion so non-string values cannot hide malformed media types.
  if (typeof input !== "string") {
    return undefined;
  }

  // Consume field whitespace, then require a non-empty type immediately
  // followed by the grammar's slash delimiter.
  let position = skipOptionalWhitespace(input, 0);
  const type = readToken(input, position);
  if (!type || input[type.nextPosition] !== "/") {
    return undefined;
  }

  // Read the subtype directly after the slash. Whitespace or an empty token
  // fails instead of being normalized into another value.
  position = type.nextPosition + 1;
  const subtype = readToken(input, position);
  if (!subtype) {
    return undefined;
  }

  position = subtype.nextPosition;
  const parameterEntries: [string, string][] = [];
  const parameterNames = new Set<string>();

  // Parse sequentially because quoted values may contain semicolons that a
  // split-based implementation would mistake for parameter delimiters.
  while (true) {
    // Reaching the end commits normalized identifiers and safely materializes
    // the accumulated entries as own data properties.
    position = skipOptionalWhitespace(input, position);
    if (position === input.length) {
      // fromEntries defines special names as own data properties instead of
      // invoking legacy setters such as Object.prototype.__proto__.
      return {
        type: type.value.toLowerCase(),
        subtype: subtype.value.toLowerCase(),
        parameters: Object.fromEntries(parameterEntries),
      };
    }

    // Any remaining content must begin a parameter; unexpected characters,
    // including a comma-combined header value, invalidate the input.
    if (input[position] !== ";") {
      return undefined;
    }

    // Names are non-empty tokens followed immediately by equals. Whitespace
    // around equals is not silently repaired.
    position = skipOptionalWhitespace(input, position + 1);
    const name = readToken(input, position);
    if (!name || input[name.nextPosition] !== "=") {
      return undefined;
    }

    // Detect duplicates after lowercase normalization so alternate casing
    // cannot overwrite a previously accepted parameter.
    const normalizedName = name.value.toLowerCase();
    if (parameterNames.has(normalizedName)) {
      return undefined;
    }

    // Select the escape-aware quoted reader or strict token reader and retain
    // the exact cursor returned by the chosen grammar branch.
    position = name.nextPosition + 1;
    const parsedValue =
      input[position] === '"' ? readQuotedString(input, position) : readToken(input, position);
    if (!parsedValue) {
      return undefined;
    }

    // Commit only a completely validated pair, then continue from the first
    // character not consumed by its value.
    parameterNames.add(normalizedName);
    parameterEntries.push([normalizedName, parsedValue.value]);
    position = parsedValue.nextPosition;
  }
}

/**
 * Reads a non-empty HTTP token.
 *
 * @param input Complete media type string.
 * @param position Token start position.
 * @returns Parsed token, or `undefined` when no token starts at the position.
 */
function readToken(
  input: string,
  position: number,
): { readonly value: string; readonly nextPosition: number } | undefined {
  // Advance over the maximal contiguous token span without accepting any
  // delimiter or character outside the explicit ASCII allowlist.
  const start = position;
  while (position < input.length && tokenCharacter.test(input[position] ?? "")) {
    position += 1;
  }

  // Empty spans are syntax failures rather than valid empty tokens.
  if (position === start) {
    return undefined;
  }

  // Preserve original spelling and return the next cursor for delimiter checks.
  return { value: input.slice(start, position), nextPosition: position };
}

/**
 * Reads and decodes an ASCII HTTP quoted-string.
 *
 * @param input Complete media type string.
 * @param position Opening quote position.
 * @returns Decoded string, or `undefined` for invalid or unterminated syntax.
 */
function readQuotedString(
  input: string,
  position: number,
): { readonly value: string; readonly nextPosition: number } | undefined {
  // The caller verified the opening quote, so accumulation starts immediately
  // after it and stores only the decoded parameter value.
  let value = "";
  position += 1;

  // Scan until a closing quote while validating every raw or escaped character.
  while (position < input.length) {
    const character = input[position];
    // Return the decoded value with the cursor positioned after the close quote.
    if (character === '"') {
      return { value, nextPosition: position + 1 };
    }

    // A backslash consumes exactly one valid quoted-pair character; a missing or
    // forbidden pair makes the entire value invalid.
    if (character === "\\") {
      const escaped = input[position + 1];
      if (!escaped || !isQuotedPairCharacter(escaped)) {
        return undefined;
      }

      value += escaped;
      position += 2;
      continue;
    }

    // Raw content must stay inside the reviewed quoted-text ranges.
    if (!character || !isQuotedTextCharacter(character)) {
      return undefined;
    }

    value += character;
    position += 1;
  }

  // End of input without a closing quote is an unterminated quoted-string.
  return undefined;
}

/**
 * Advances over optional HTTP spaces and horizontal tabs.
 *
 * @param input Complete media type string.
 * @param position Position at which optional whitespace may begin.
 * @returns First position after optional whitespace.
 */
function skipOptionalWhitespace(input: string, position: number): number {
  // Only space and horizontal tab are optional HTTP whitespace; line breaks
  // remain unconsumed so the outer parser rejects them.
  while (input[position] === " " || input[position] === "\t") {
    position += 1;
  }
  return position;
}

/**
 * Determines whether a character is valid unescaped quoted-string text.
 *
 * @param character Single character to inspect.
 * @returns Whether the character is valid quoted text.
 */
function isQuotedTextCharacter(character: string): boolean {
  // Convert once so the accepted ASCII ranges remain explicit and locale-free.
  const codePoint = character.codePointAt(0);
  // Permit tab, space, and visible ASCII except quote and backslash; controls
  // and raw Unicode remain outside these ranges.
  return (
    codePoint !== undefined &&
    (codePoint === 0x09 ||
      codePoint === 0x20 ||
      codePoint === 0x21 ||
      (codePoint >= 0x23 && codePoint <= 0x5b) ||
      (codePoint >= 0x5d && codePoint <= 0x7e))
  );
}

/**
 * Determines whether a character can appear after a quoted-pair backslash.
 *
 * @param character Single escaped character to inspect.
 * @returns Whether the character is a valid quoted-pair value.
 */
function isQuotedPairCharacter(character: string): boolean {
  // Quoted pairs permit horizontal tab or printable ASCII only; a numeric range
  // makes the upper boundary explicit and rejects Unicode input.
  const codePoint = character.codePointAt(0);
  return (
    codePoint !== undefined && (codePoint === 0x09 || (codePoint >= 0x20 && codePoint <= 0x7e))
  );
}
