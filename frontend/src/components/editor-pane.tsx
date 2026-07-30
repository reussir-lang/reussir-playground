import { useAtomValue } from "jotai";
import { Download } from "lucide-react";
import { useCallback } from "react";

import { SourceEditor } from "@/components/source-editor";
import { sourceCodeAtom } from "@/store/atoms";

function download(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function EditorPane() {
  const sourceCode = useAtomValue(sourceCodeAtom);

  const handleDownload = useCallback(() => {
    download(sourceCode, "main.rr");
  }, [sourceCode]);

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-3 py-1.5 bg-bg-elevated text-[11px] font-semibold text-text-secondary uppercase tracking-wider border-b border-border shrink-0 flex items-center">
        <span>Reussir Source</span>
        <span className="ml-2 normal-case font-normal tracking-normal text-text-secondary">
          PolyFFI and entry point included
        </span>
        <button
          type="button"
          onClick={handleDownload}
          className="ml-auto p-0.5 rounded text-text-secondary hover:text-text-primary transition-colors"
          title="Download as .rr"
        >
          <Download size={12} />
        </button>
      </div>
      <div className="flex-1 min-h-0">
        <SourceEditor />
      </div>
    </div>
  );
}
