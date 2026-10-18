// Copyright © 2026 Mcont.

import {
  isUriValue,
  type Artifact,
  type ArtifactCatalog,
  type Diagnostic,
  type InlineArtifactSource,
  type ModelRequest,
  type ProcessingResult,
} from "@evolutos/mconet-core-domain";

/** Largest inline image accepted into one request body. 20 MiB. */
const maxImageArtifactBytes = 20_971_520;

/** Image artifact kind this reader materializes. */
const imageArtifactKindId = "artifact.image";

/** Source that already holds bytes. */
const inlineSourceKind = "artifact.source.inline";

/** Source that names a URI. */
const uriSourceKind = "artifact.source.uri";

/** Schemes this reader will fetch. Other schemes never leave the process. */
const fetchableProtocols = new Set(["http:", "https:"]);

/** Characters in one base64 group. */
const base64CharactersPerGroup = 4;

/** PNG signature bytes. Runtime cannot import the integration codec that also knows these. */
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
 * Reads image artifact sources into inline bytes on a request copy.
 *
 * Inline bytes are copied. Absolute http(s) URIs are fetched without
 * credentials and without the model API key. Redirects are followed because
 * this request carries no model credential; the model transport still refuses
 * redirects so an API key is not replayed. Data URIs are decoded locally. A
 * fetched image keeps an `image/*` Content-Type. When that header is absent,
 * a known image signature or the caller's image media type is used. The
 * original request is returned unchanged when the catalog is empty. This stage
 * runs before the model credential is read.
 *
 * @param input Request, fetch implementation, abort signal, and optional byte cap.
 * @returns A request whose image sources are inline, or one diagnostic.
 */
export async function materializeImageArtifactSources(input: {
  readonly request: ModelRequest;
  readonly fetchImpl: typeof fetch;
  readonly signal: AbortSignal;
  readonly maxBytes?: number;
}): Promise<ProcessingResult<ModelRequest>> {
  const catalog = input.request.task.artifacts;
  // An empty catalog is the text-only path. Returning the same request avoids
  // a fetch and avoids copying a task that has no image sources to read.
  if (catalog.artifacts.length === 0) {
    return { diagnostics: [], value: input.request };
  }

  const maxBytes = input.maxBytes ?? maxImageArtifactBytes;
  const next: Artifact[] = [];
  for (let index = 0; index < catalog.artifacts.length; index += 1) {
    const artifact = catalog.artifacts[index];
    if (artifact === undefined) {
      return failed(
        "unsupported_message_content",
        "Image artifact is missing.",
        `artifacts[${index}]`,
      );
    }
    const read = await readArtifact(artifact, index, input.fetchImpl, input.signal, maxBytes);
    // Stop at the first unreadable image. A partial catalog would send some
    // images and silently omit the one that failed.
    if (read.artifact === undefined) {
      return { diagnostics: read.diagnostics };
    }
    next.push(read.artifact);
  }

  // Replace only the catalog. Message artifact ids stay valid because each
  // inline copy keeps the id of the artifact it was read from.
  const artifacts: ArtifactCatalog = { artifacts: next };
  return {
    diagnostics: [],
    value: {
      ...input.request,
      task: {
        ...input.request.task,
        artifacts,
      },
    },
  };
}

/** One read attempt. */
interface ReadAttempt {
  readonly artifact?: Artifact;
  readonly diagnostics: readonly Diagnostic[];
}

/**
 * Copies or fetches one image into an inline artifact.
 *
 * @param artifact Catalog image.
 * @param index Catalog position, used only in diagnostics.
 * @param fetchImpl Fetch implementation. It is not called for inline bytes or data URIs.
 * @param signal Abort signal for the fetch.
 * @param maxBytes Inclusive byte cap.
 * @returns The inline artifact, or diagnostics.
 */
async function readArtifact(
  artifact: Artifact,
  index: number,
  fetchImpl: typeof fetch,
  signal: AbortSignal,
  maxBytes: number,
): Promise<ReadAttempt> {
  const path = `artifacts[${index}]`;
  if (artifact.kind.id !== imageArtifactKindId) {
    return rejected(
      "unsupported_message_content",
      "Only image artifacts can be read into a chat request.",
      `${path}.kind`,
    );
  }
  const source = artifact.source;
  if (source.kind === inlineSourceKind && "bytes" in source && source.bytes instanceof Uint8Array) {
    // Copy the bytes so a later change to the caller buffer cannot change
    // the request body. This branch does not fetch.
    if (source.bytes.byteLength > maxBytes) {
      return rejected(
        "artifact_too_large",
        "Inline image exceeds the byte limit.",
        `${path}.source`,
      );
    }
    const inlineSource: InlineArtifactSource = {
      kind: inlineSourceKind,
      bytes: new Uint8Array(source.bytes),
    };
    return { diagnostics: [], artifact: { ...artifact, source: inlineSource } };
  }
  const uri = "uri" in source ? source.uri : undefined;
  // Only an absolute URI is readable. A relative URI has no base here.
  if (source.kind === uriSourceKind && isUriValue(uri) && uri.kind === "absolute") {
    return readUri(artifact, uri.value, index, fetchImpl, signal, maxBytes);
  }
  return rejected(
    "unsupported_artifact_source",
    "Image artifact source cannot be read.",
    `${path}.source`,
  );
}

/**
 * Fetches an http(s) URI or decodes a data URI.
 *
 * @param artifact Original artifact. Identity and kind are preserved.
 * @param uri Absolute URI text.
 * @param index Catalog position.
 * @param fetchImpl Fetch implementation.
 * @param signal Abort signal.
 * @param maxBytes Inclusive byte cap.
 * @returns The inline artifact, or diagnostics. The URI is not copied into the diagnostic.
 */
async function readUri(
  artifact: Artifact,
  uri: string,
  index: number,
  fetchImpl: typeof fetch,
  signal: AbortSignal,
  maxBytes: number,
): Promise<ReadAttempt> {
  const path = `artifacts[${index}].source`;
  // A data URI is already in the process. Decoding it locally keeps fetch
  // from treating the payload as an http URL.
  if (uri.startsWith("data:")) {
    const decoded = decodeDataUrl(uri);
    if (decoded === undefined) {
      return rejected("unsupported_artifact_source", "Image data URI could not be decoded.", path);
    }
    if (decoded.bytes.byteLength > maxBytes) {
      return rejected("artifact_too_large", "Image data URI exceeds the byte limit.", path);
    }
    const mediaType = imageMediaType(decoded.mediaType) ?? imageMediaType(artifact.mediaType);
    if (mediaType === undefined) {
      return rejected(
        "unsupported_artifact_source",
        "Image data URI has no image media type.",
        path,
      );
    }
    return {
      diagnostics: [],
      artifact: inlineArtifact(artifact, decoded.bytes, mediaType),
    };
  }

  let url: URL;
  try {
    url = new URL(uri);
  } catch {
    return rejected("unsupported_artifact_source", "Image URI is not absolute.", path);
  }
  if (!fetchableProtocols.has(url.protocol) || url.username.length > 0 || url.password.length > 0) {
    return rejected(
      "unsupported_artifact_source",
      "Image URI must be http(s) without userinfo.",
      path,
    );
  }

  let response: Response;
  try {
    // Follow redirects because this request carries no model credential.
    // Credentials stay omitted so a browser cookie is not sent with the image.
    response = await fetchImpl(url, {
      method: "GET",
      redirect: "follow",
      signal,
      credentials: "omit",
      cache: "no-store",
      referrerPolicy: "no-referrer",
    });
  } catch {
    if (signal.aborted) {
      return rejected("interaction_cancelled", "Image fetch was cancelled.", path);
    }
    return rejected("artifact_source_unreadable", "Image URI could not be fetched.", path);
  }
  if (!response.ok) {
    return rejected("artifact_source_unreadable", "Image URI request failed.", path);
  }
  // Check the URL after redirects. A hop must not introduce userinfo or
  // leave http(s), even though the original URL already passed that check.
  if (response.url.length > 0 && !isFetchableHttpUrl(response.url)) {
    return rejected(
      "unsupported_artifact_source",
      "Image URI must be http(s) without userinfo.",
      path,
    );
  }
  const declaredLength = response.headers.get("content-length");
  if (declaredLength !== null && Number(declaredLength) > maxBytes) {
    return rejected("artifact_too_large", "Image URI exceeds the byte limit.", path);
  }
  const header = response.headers.get("content-type");
  // A non-image Content-Type is rejected before the body is stored. The
  // caller's media type must not relabel an HTML response as an image.
  if (header !== null && imageMediaType(header) === undefined) {
    return rejected(
      "unsupported_artifact_source",
      "Image response Content-Type is not an image media type.",
      path,
    );
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > maxBytes) {
    return rejected("artifact_too_large", "Image URI exceeds the byte limit.", path);
  }
  // A missing Content-Type falls through to the image signature, then to the
  // caller's image media type. If none of those name an image, the bytes
  // stay out of the request instead of failing later as a source-shape error.
  const mediaType =
    (header === null ? undefined : imageMediaType(header)) ??
    mediaTypeFromImageMagic(bytes) ??
    imageMediaType(artifact.mediaType);
  if (mediaType === undefined) {
    return rejected("unsupported_artifact_source", "Image response has no image media type.", path);
  }
  return {
    diagnostics: [],
    artifact: inlineArtifact(artifact, bytes, mediaType),
  };
}

/**
 * Accepts an absolute http(s) URL that does not carry userinfo.
 *
 * @param value URL text, including a redirect target.
 * @returns Whether this reader may treat the URL as an image source.
 */
function isFetchableHttpUrl(value: string): boolean {
  // A redirect target that does not parse, or that leaves http(s), is not
  // stored. Userinfo is rejected so it is not sent on the next hop.
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  return (
    fetchableProtocols.has(url.protocol) && url.username.length === 0 && url.password.length === 0
  );
}

/**
 * Returns a copy of `artifact` whose source is the supplied bytes.
 *
 * @param artifact Original artifact.
 * @param bytes Bytes owned by the returned artifact.
 * @param mediaType Media type to store when one is known.
 * @returns The inline artifact.
 */
function inlineArtifact(
  artifact: Artifact,
  bytes: Uint8Array,
  mediaType: string | undefined,
): Artifact {
  const source: InlineArtifactSource = { kind: inlineSourceKind, bytes };
  return {
    ...artifact,
    ...(mediaType === undefined ? {} : { mediaType }),
    source,
  };
}

/**
 * Returns the media type when the value is an image type.
 *
 * @param value Content-Type header or a caller-supplied media type.
 * @returns The type/subtype, or `undefined` when it is absent or not an image.
 */
function imageMediaType(value: string | null | undefined): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  // Parameters after ';' are not part of the type/subtype comparison.
  const mediaType = value.split(";", 1)[0]?.trim().toLowerCase();
  if (
    mediaType === undefined ||
    !mediaType.startsWith("image/") ||
    mediaType.length <= "image/".length
  ) {
    return undefined;
  }
  return mediaType;
}

/**
 * Returns an image media type when the bytes match a known signature.
 *
 * The integration package has the same recognition for response recovery.
 * This package cannot import that package, so the signatures live here too.
 *
 * @param bytes Bytes to inspect. The function reads only the header.
 * @returns `image/png`, `image/jpeg`, `image/gif`, or `image/webp`.
 */
function mediaTypeFromImageMagic(bytes: Uint8Array): string | undefined {
  // Unrecognized bytes stay undefined. The caller then uses its own image
  // media type, or the read fails, instead of guessing a type.
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

/** Reports whether `bytes` begins with `signature`. */
function startsWith(bytes: Uint8Array, signature: readonly number[]): boolean {
  if (bytes.length < signature.length) {
    return false;
  }
  return signature.every((byte, index) => bytes[index] === byte);
}

/**
 * Decodes a base64 data URI.
 *
 * @param uri Data URI.
 * @returns Bytes and declared media type, or `undefined` when the URI is not base64.
 */
function decodeDataUrl(
  uri: string,
): { readonly bytes: Uint8Array; readonly mediaType?: string } | undefined {
  // The comma separates the media type from the payload. A URI without one
  // is not a base64 image this reader can store.
  const comma = uri.indexOf(",");
  if (comma < 0) {
    return undefined;
  }
  const header = uri.slice("data:".length, comma);
  if (!header.includes("base64")) {
    return undefined;
  }
  const bytes = decodeBase64(uri.slice(comma + 1));
  if (bytes === undefined) {
    return undefined;
  }
  const mediaType = header.replace(/;base64$/, "");
  // Keep a declared image type. Any other declaration is omitted so the
  // caller media type, if it is an image type, can still apply.
  return mediaType.startsWith("image/") ? { bytes, mediaType } : { bytes };
}

/**
 * Decodes standard base64.
 *
 * Whitespace and a truncated group are rejected. This copy lives in the
 * runtime because the runtime cannot import the integration codec.
 *
 * @param value Base64 text with no data-URI prefix.
 * @returns The bytes, or `undefined` when the text is not valid base64.
 */
function decodeBase64(value: string): Uint8Array | undefined {
  // A complete payload is one or more groups of four characters. Anything
  // shorter is not decoded as an empty image.
  if (value.length === 0 || value.length % base64CharactersPerGroup !== 0) {
    return undefined;
  }
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const output: number[] = [];
  for (let index = 0; index < value.length; index += base64CharactersPerGroup) {
    const group = value.slice(index, index + base64CharactersPerGroup);
    const padding = group.endsWith("==") ? 2 : group.endsWith("=") ? 1 : 0;
    const indexes = [...group].map((character, characterIndex) => {
      if (character === "=" && characterIndex >= base64CharactersPerGroup - padding) {
        return 0;
      }
      const found = alphabet.indexOf(character);
      return found;
    });
    if (indexes.some((item) => item < 0) || /[^A-Za-z0-9+/=]/u.test(group)) {
      return undefined;
    }
    const combined =
      ((indexes[0] ?? 0) << 18) |
      ((indexes[1] ?? 0) << 12) |
      ((indexes[2] ?? 0) << 6) |
      (indexes[3] ?? 0);
    output.push((combined >> 16) & 0xff);
    if (padding < 2) {
      output.push((combined >> 8) & 0xff);
    }
    if (padding < 1) {
      output.push(combined & 0xff);
    }
  }
  return Uint8Array.from(output);
}

/** Returns a read failure with one diagnostic and no artifact. */
function rejected(code: string, message: string, path: string): ReadAttempt {
  return { diagnostics: [diagnostic(code, message, path)] };
}

/** Returns a processing failure with one diagnostic and no request. */
function failed(code: string, message: string, path: string): ProcessingResult<ModelRequest> {
  return { diagnostics: [diagnostic(code, message, path)] };
}

/**
 * Returns one diagnostic.
 *
 * Fetch failures use the transport phase. The other failures are validation
 * because the source never became request bytes. The URI and bytes stay out of
 * the message.
 *
 * @param code Stable diagnostic code.
 * @param message Technical summary.
 * @param path Field that failed.
 * @returns The diagnostic.
 */
function diagnostic(code: string, message: string, path: string): Diagnostic {
  const phase = code === "artifact_source_unreadable" ? "transport" : "validation";
  return {
    code,
    severity: "error",
    phase,
    message,
    path,
  };
}
