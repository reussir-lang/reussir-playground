import Editor, { type Monaco } from "@monaco-editor/react";
import { useAtomValue } from "jotai";
import { Download } from "lucide-react";
import { useCallback } from "react";

import {
  llvmIrLanguage,
  mlirLanguage,
  watLanguage,
} from "@/lang/output-languages";
import { reussirDarkTheme, reussirLightTheme } from "@/lang/reussir-theme";
import { cn } from "@/lib/utils";
import { modeAtom, outputAtom, outputLabelAtom, themeAtom } from "@/store/atoms";

const MODE_LANGUAGE: Record<string, string> = {
  "llvm-ir": "llvm-ir",
  asm: "wat",
  mlir: "mlir",
};

const MODE_EXT: Record<string, string> = {
  run: "txt",
  "llvm-ir": "ll",
  asm: "wat",
  mlir: "mlir",
};

let outputLanguagesRegistered = false;

function registerOutputLanguages(monaco: Monaco) {
  if (outputLanguagesRegistered) return;
  outputLanguagesRegistered = true;

  monaco.languages.register({ id: "llvm-ir" });
  monaco.languages.setMonarchTokensProvider("llvm-ir", llvmIrLanguage);

  monaco.languages.register({ id: "wat" });
  monaco.languages.setMonarchTokensProvider("wat", watLanguage);

  monaco.languages.register({ id: "mlir" });
  monaco.languages.setMonarchTokensProvider("mlir", mlirLanguage);

  monaco.editor.defineTheme("reussir-dark", reussirDarkTheme);
  monaco.editor.defineTheme("reussir-light", reussirLightTheme);
}

export function OutputPanel() {
  const output = useAtomValue(outputAtom);
  const label = useAtomValue(outputLabelAtom);
  const mode = useAtomValue(modeAtom);
  const theme = useAtomValue(themeAtom);

  const handleBeforeMount = useCallback((monaco: Monaco) => {
    registerOutputLanguages(monaco);
  }, []);

  const handleDownload = useCallback(() => {
    const ext = MODE_EXT[mode] ?? "txt";
    const blob = new Blob([output.text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `output.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  }, [mode, output.text]);

  const language = MODE_LANGUAGE[mode];
  const useEditor =
    language && output.kind === "success";

  return (
    <div className="flex flex-col min-h-0 h-full">
      <div className="px-3 py-1.5 bg-bg-elevated text-[11px] font-semibold text-text-secondary uppercase tracking-wider border-b border-border shrink-0 flex items-center">
        <span>{label}</span>
        {output.kind === "success" && (
          <button
            type="button"
            onClick={handleDownload}
            className="ml-auto p-0.5 rounded text-text-secondary hover:text-text-primary transition-colors"
            title={`Download as .${MODE_EXT[mode] ?? "txt"}`}
          >
            <Download size={12} />
          </button>
        )}
      </div>
      {output.kind === "idle" ? (
        <div className="flex-1 flex items-center justify-center p-6 min-h-0">
          <p className="text-text-secondary text-sm text-center">
            {output.text}
          </p>
        </div>
      ) : useEditor ? (
        <div className="flex-1 min-h-0">
          <Editor
            language={language}
            theme={theme === "dark" ? "reussir-dark" : "reussir-light"}
            value={output.text}
            beforeMount={handleBeforeMount}
            options={{
              readOnly: true,
              domReadOnly: true,
              fontSize: 13,
              fontFamily:
                "'Fira Code', 'Cascadia Code', 'Consolas', 'Monaco', monospace",
              lineHeight: 20,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              automaticLayout: true,
              padding: { top: 8 },
              renderLineHighlight: "none",
              lineNumbers: "on",
            }}
          />
        </div>
      ) : (
        <pre
          className={cn(
            "flex-1 p-3 font-mono text-[13px] leading-[1.5] whitespace-pre-wrap break-words overflow-auto bg-bg-primary text-text-primary min-h-0",
            output.kind === "error" && "text-error",
            output.kind === "loading" && "text-text-secondary italic",
          )}
        >
          {output.text}
        </pre>
      )}
    </div>
  );
}
