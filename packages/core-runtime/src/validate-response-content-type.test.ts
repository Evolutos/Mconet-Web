// Copyright © 2026 Mcont.

import type { MediaType } from "@evolutos/mconet-core-domain";
import type { PayloadDecoder } from "@evolutos/mconet-core-spi";
import { expect, it } from "vitest";

import { validateResponseContentType } from "./validate-response-content-type.js";

const json: MediaType = { type: "application", subtype: "json", parameters: {} };
const jsonWithCharset: MediaType = {
  type: "application",
  subtype: "json",
  parameters: { charset: "utf-8" },
};

function decoder(inputMediaTypes?: readonly MediaType[]): PayloadDecoder {
  return {
    descriptor: {
      name: "decoder",
      version: "1.0.0",
      capabilities: new Set(),
      source: "builtin",
      ...(inputMediaTypes === undefined ? {} : { typeContract: { inputMediaTypes } }),
    },
    decode: () => {
      throw new Error("decode");
    },
  };
}

it("keeps the selected decoder when the content type family matches", () => {
  const selected = decoder([json]);

  expect(validateResponseContentType({ mediaType: jsonWithCharset, decoder: selected }).value).toBe(
    selected,
  );
});

it("fails a mismatched content type without choosing another decoder", () => {
  const selected = decoder([json]);
  const result = validateResponseContentType({
    mediaType: { type: "text", subtype: "plain", parameters: {} },
    decoder: selected,
  });

  expect(result.value).toBeUndefined();
  expect(result.diagnostics[0]?.code).toBe("content_type_mismatch");
  expect(result.diagnostics[0]?.phase).toBe("decoding");
});

it("accepts a missing content type when the decoder declares no media types", () => {
  const selected = decoder();

  expect(validateResponseContentType({ decoder: selected }).value).toBe(selected);
});
