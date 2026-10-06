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
  if (typeof input !== "string") {
    return undefined;
  }

  let position = skipOptionalWhitespace(input, 0);
  const type = readToken(input, position);
  if (!type || input[type.nextPosition] !== "/") {
    return undefined;
  }

  position = type.nextPosition + 1;
  const subtype = readToken(input, position);
  if (!subtype) {
    return undefined;
  }

  position = subtype.nextPosition;
  const parameterEntries: [string, string][] = [];
  const parameterNames = new Set<string>();

  while (true) {
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

    if (input[position] !== ";") {
      return undefined;
    }

    position = skipOptionalWhitespace(input, position + 1);
    const name = readToken(input, position);
    if (!name || input[name.nextPosition] !== "=") {
      return undefined;
    }

    const normalizedName = name.value.toLowerCase();
    if (parameterNames.has(normalizedName)) {
      return undefined;
    }

    position = name.nextPosition + 1;
    const parsedValue =
      input[position] === '"' ? readQuotedString(input, position) : readToken(input, position);
    if (!parsedValue) {
      return undefined;
    }

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
  const start = position;
  while (position < input.length && tokenCharacter.test(input[position] ?? "")) {
    position += 1;
  }

  if (position === start) {
    return undefined;
  }

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
  let value = "";
  position += 1;

  while (position < input.length) {
    const character = input[position];
    if (character === '"') {
      return { value, nextPosition: position + 1 };
    }

    if (character === "\\") {
      const escaped = input[position + 1];
      if (!escaped || !isQuotedPairCharacter(escaped)) {
        return undefined;
      }

      value += escaped;
      position += 2;
      continue;
    }

    if (!character || !isQuotedTextCharacter(character)) {
      return undefined;
    }

    value += character;
    position += 1;
  }

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
  const codePoint = character.codePointAt(0);
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
  const codePoint = character.codePointAt(0);
  return (
    codePoint !== undefined && (codePoint === 0x09 || (codePoint >= 0x20 && codePoint <= 0x7e))
  );
}
