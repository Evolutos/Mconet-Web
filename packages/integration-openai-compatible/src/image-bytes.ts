// Copyright © 2026 Mcont.

/** Base64 alphabet in index order. Padding is not part of the alphabet. */
const base64Alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** Padding character required when a group is short one or two bytes. */
const base64Padding = "=";

/** Bytes consumed by one base64 group. */
const base64BytesPerGroup = 3;

/** Characters produced by one base64 group. */
const base64CharactersPerGroup = 4;

/** Mask for one 6-bit base64 index. */
const sixBitMask = 0b111_111;

/** Shift of the first byte inside a 24-bit group. */
const firstByteShift = 16;

/** Shift of the second byte inside a 24-bit group. */
const secondByteShift = 8;

/** Shift of the first 6-bit index. */
const firstIndexShift = 18;

/** Shift of the second 6-bit index. */
const secondIndexShift = 12;

/** Shift of the third 6-bit index. */
const thirdIndexShift = 6;

/** PNG signature bytes. */
const pngSignature = [0x89, 0x50, 0x4e, 0x47] as const;

/** JPEG start-of-image marker. */
const jpegSignature = [0xff, 0xd8, 0xff] as const;

/** GIF signature prefix. */
const gifSignature = [0x47, 0x49, 0x46] as const;

/** RIFF container prefix used by WebP. */
const riffSignature = [0x52, 0x49, 0x46, 0x46] as const;

/** WebP form type at offset 8. */
const webpSignature = [0x57, 0x45, 0x42, 0x50] as const;

/** Offset of the WebP form type inside a RIFF header. */
const webpFormOffset = 8;

/**
 * Encodes bytes as standard base64 without newlines.
 *
 * @param bytes Image bytes to place in a data URI or Ollama `images` entry.
 * @returns The base64 text.
 */
export function encodeBytesAsBase64(bytes: Uint8Array): string {
  // One group is three bytes and four characters. A short final group is
  // padded so the text length stays a multiple of four and decoders do not
  // have to accept a truncated alphabet sequence.
  const characters: string[] = [];
  for (let index = 0; index < bytes.length; index += base64BytesPerGroup) {
    const first = bytes[index] ?? 0;
    const second = index + 1 < bytes.length ? bytes[index + 1] : undefined;
    const third = index + 2 < bytes.length ? bytes[index + 2] : undefined;
    const group = (first << firstByteShift) | ((second ?? 0) << secondByteShift) | (third ?? 0);
    characters.push(characterAt(group >> firstIndexShift));
    characters.push(characterAt(group >> secondIndexShift));
    characters.push(second === undefined ? base64Padding : characterAt(group >> thirdIndexShift));
    characters.push(third === undefined ? base64Padding : characterAt(group));
  }
  return characters.join("");
}

/**
 * Decodes standard base64, including padding.
 *
 * @param value Base64 text with no whitespace or data-URI prefix.
 * @returns The bytes, or `undefined` when the text is not valid base64.
 */
export function decodeBase64ToBytes(value: string): Uint8Array | undefined {
  // A valid payload is one or more complete groups. An empty string and a
  // truncated group are rejected rather than decoded as zero bytes.
  if (value.length === 0 || value.length % base64CharactersPerGroup !== 0) {
    return undefined;
  }
  const output: number[] = [];
  for (let index = 0; index < value.length; index += base64CharactersPerGroup) {
    const group = value.slice(index, index + base64CharactersPerGroup);
    const padding = group.endsWith("==") ? 2 : group.endsWith("=") ? 1 : 0;
    // Padding is valid only in the final group. An earlier pad would hide
    // bytes that the length check had already counted as present.
    if (padding > 0 && index + base64CharactersPerGroup !== value.length) {
      return undefined;
    }
    const indexes = group.split("").map((character, characterIndex) => {
      if (characterIndex >= base64CharactersPerGroup - padding && character === base64Padding) {
        return 0;
      }
      return base64Alphabet.indexOf(character);
    });
    if (indexes.some((item) => item < 0)) {
      return undefined;
    }
    const first = indexes[0] ?? 0;
    const second = indexes[1] ?? 0;
    const third = indexes[2] ?? 0;
    const fourth = indexes[3] ?? 0;
    const combined =
      (first << firstIndexShift) |
      (second << secondIndexShift) |
      (third << thirdIndexShift) |
      fourth;
    output.push((combined >> firstByteShift) & 0xff);
    if (padding < 2) {
      output.push((combined >> secondByteShift) & 0xff);
    }
    if (padding < 1) {
      output.push(combined & 0xff);
    }
  }
  return Uint8Array.from(output);
}

/**
 * Returns an image media type when the bytes match a known signature.
 *
 * @param bytes Bytes to inspect. The function reads only the header.
 * @returns `image/png`, `image/jpeg`, `image/gif`, or `image/webp`.
 */
export function mediaTypeFromImageMagic(bytes: Uint8Array): string | undefined {
  // Only the header is read. An unrecognized signature stays undefined so a
  // caller-supplied image media type can still name the bytes.
  if (startsWith(bytes, pngSignature)) {
    return "image/png";
  }
  if (startsWith(bytes, jpegSignature)) {
    return "image/jpeg";
  }
  if (startsWith(bytes, gifSignature)) {
    return "image/gif";
  }
  if (
    startsWith(bytes, riffSignature) &&
    startsWith(bytes.subarray(webpFormOffset), webpSignature)
  ) {
    return "image/webp";
  }
  return undefined;
}

/** Returns one alphabet character for a 6-bit index. */
function characterAt(value: number): string {
  return base64Alphabet[value & sixBitMask] ?? base64Alphabet[0] ?? "A";
}

/** Reports whether `bytes` begins with `signature`. */
function startsWith(bytes: Uint8Array, signature: readonly number[]): boolean {
  if (bytes.length < signature.length) {
    return false;
  }
  return signature.every((byte, index) => bytes[index] === byte);
}
