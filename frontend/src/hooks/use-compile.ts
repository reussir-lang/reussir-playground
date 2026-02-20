import { useCallback } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import {
  sourceCodeAtom,
  driverCodeAtom,
  modeAtom,
  optLevelAtom,
  isCompilingAtom,
  outputAtom,
} from "@/store/atoms";
import { compileCode, b64ToBytes } from "@/api/compile";
import { runWasm } from "@/runtime/wasi";

export function useCompile() {
  const source = useAtomValue(sourceCodeAtom);
  const driver = useAtomValue(driverCodeAtom);
  const mode = useAtomValue(modeAtom);
  const opt = useAtomValue(optLevelAtom);
  const setIsCompiling = useSetAtom(isCompilingAtom);
  const setOutput = useSetAtom(outputAtom);

  return useCallback(async () => {
    setOutput({
      kind: "loading",
      text: mode === "run" ? "Compiling to wasm\u2026" : "Compiling\u2026",
    });
    setIsCompiling(true);

    try {
      const data = await compileCode({ source, driver, mode, opt });

      if (!data.success) {
        setOutput({
          kind: "error",
          text: data.error ?? "Unknown compilation error.",
        });
        return;
      }

      if (data.output !== undefined) {
        setOutput({
          kind: "success",
          text: data.output || "(empty output)",
        });
        return;
      }

      if (data.wasm !== undefined) {
        setOutput({ kind: "loading", text: "Running in browser\u2026" });
        const wasmBytes = b64ToBytes(data.wasm);
        try {
          const result = await runWasm(wasmBytes);
          let text = result.stdout;
          if (result.stderr) {
            if (text) text += "\n";
            text += `--- stderr ---\n${result.stderr}`;
          }
          if (result.exitCode !== 0) {
            if (text) text += "\n";
            text += `\nProcess exited with code ${result.exitCode}.`;
          }
          setOutput({
            kind: result.exitCode !== 0 ? "error" : "success",
            text: text || "(no output)",
          });
        } catch (e) {
          setOutput({
            kind: "error",
            text: `WASI error: ${(e as Error).message}`,
          });
        }
        return;
      }

      setOutput({
        kind: "error",
        text: "Unexpected response from server.",
      });
    } catch (e) {
      setOutput({
        kind: "error",
        text: `Request failed: ${(e as Error).message}`,
      });
    } finally {
      setIsCompiling(false);
    }
  }, [source, driver, mode, opt, setIsCompiling, setOutput]);
}
