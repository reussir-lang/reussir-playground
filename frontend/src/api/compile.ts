import { z } from "zod";
import type { Mode, OptLevel } from "@/store/atoms";

export interface CompileRequest {
  source: string;
  driver: string;
  mode: Mode;
  opt: OptLevel;
}

export const CompileResponseSchema = z.object({
  success: z.boolean(),
  output: z.string().optional(),
  wasm: z.string().optional(),
  error: z.string().optional(),
});

export type CompileResponse = z.infer<typeof CompileResponseSchema>;

export async function compileCode(
  req: CompileRequest,
): Promise<CompileResponse> {
  const resp = await fetch("/api/compile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });

  if (!resp.ok) {
    throw new Error(`server error ${resp.status}: ${resp.statusText}`);
  }

  const data: unknown = await resp.json();
  return CompileResponseSchema.parse(data);
}

export function b64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
