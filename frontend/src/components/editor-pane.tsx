import { useAtomValue } from "jotai";
import { Download, GripHorizontal } from "lucide-react";
import { useCallback } from "react";
import { Group, Panel, Separator } from "react-resizable-panels";

import { DriverEditor } from "@/components/driver-editor";
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
    download(sourceCode, "main.re");
  }, [sourceCode]);

  return (
    <Group orientation="vertical">
      <Panel defaultSize="60%" minSize="10%">
        <div className="flex flex-col h-full min-h-0">
          <div className="px-3 py-1.5 bg-bg-elevated text-[11px] font-semibold text-text-secondary uppercase tracking-wider border-b border-border shrink-0 flex items-center">
            <span>Reussir Source</span>
            <button
              type="button"
              onClick={handleDownload}
              className="ml-auto p-0.5 rounded text-text-secondary hover:text-text-primary transition-colors"
              title="Download as .re"
            >
              <Download size={12} />
            </button>
          </div>
          <div className="flex-1 min-h-0">
            <SourceEditor />
          </div>
        </div>
      </Panel>

      <Separator className="h-2.5 bg-bg-secondary border-y border-border-subtle hover:bg-divider-hover active:bg-divider-active relative touch-none flex items-center justify-center transition-colors">
        <GripHorizontal size={14} className="text-grip" />
      </Separator>

      <Panel defaultSize="40%" minSize="10%">
        <div className="flex flex-col h-full min-h-0">
          <div className="px-3 py-1.5 bg-bg-elevated text-[11px] font-semibold text-text-secondary uppercase tracking-wider border-b border-border shrink-0">
            Rust Driver
          </div>
          <div className="flex-1 min-h-0">
            <DriverEditor />
          </div>
        </div>
      </Panel>
    </Group>
  );
}
