// Copyright © 2026 Mcont.

import { expect, it } from "vitest";

import type { InteractionMode } from "@evolutos/mconet-core-domain";

import {
  matchesUnaryInteractionMode,
  UNARY_INTERACTION_MODE_ID,
} from "./match-interaction-mode.js";

it("matches only the unary mode id", () => {
  expect(matchesUnaryInteractionMode({ id: UNARY_INTERACTION_MODE_ID })).toBe(true);
  expect(matchesUnaryInteractionMode({ id: "unary" })).toBe(true);
});

it("rejects another mode without inferring unary", () => {
  expect(matchesUnaryInteractionMode({ id: "server_stream" })).toBe(false);
  expect(matchesUnaryInteractionMode({ id: "Unary" })).toBe(false);
  expect(matchesUnaryInteractionMode({ id: "client_stream" })).toBe(false);
  expect(matchesUnaryInteractionMode({ id: "duplex" })).toBe(false);
  expect(matchesUnaryInteractionMode({ id: "long_running" })).toBe(false);
});

it("rejects a missing mode", () => {
  expect(matchesUnaryInteractionMode(undefined as unknown as InteractionMode)).toBe(false);
});
