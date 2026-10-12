// Copyright © 2026 Mcont.

import type {
  Diagnostic,
  ModelOutput,
  ModelRequest,
  ParsedTaskResponse,
} from "@evolutos/mconet-core-domain";

import { ModelOutputAssembler } from "./model-output-assembler.js";

/**
 * Schedules assembly of one public model output.
 *
 * The runtime assembler is called once. The request supplies the target, the
 * parsed response supplies the service facts, and the diagnostics stay the
 * runtime collection. This stage does not infer omitted usage or model identity
 * and does not call a transport.
 *
 * @param input Request, parsed response, runtime diagnostics, and optional output id.
 * @returns The frozen public output.
 */
export function scheduleModelOutputAssembly(input: {
  readonly request: ModelRequest;
  readonly response: ParsedTaskResponse;
  readonly diagnostics: readonly Diagnostic[];
  readonly outputId?: string;
}): ModelOutput {
  return ModelOutputAssembler.assemble(input);
}
