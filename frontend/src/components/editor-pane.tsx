import { GripHorizontal } from "lucide-react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";

import { DriverEditor } from "@/components/driver-editor";
import { SourceEditor } from "@/components/source-editor";

export function EditorPane() {
  return (
    <PanelGroup direction="vertical">
      <Panel defaultSize={60} minSize={10}>
        <div className="flex flex-col h-full min-h-0">
          <div className="px-3 py-1.5 bg-bg-elevated text-[11px] font-semibold text-text-secondary uppercase tracking-wider border-b border-border shrink-0">
            Reussir Source
          </div>
          <div className="flex-1 min-h-0">
            <SourceEditor />
          </div>
        </div>
      </Panel>

      <PanelResizeHandle className="h-2.5 bg-bg-secondary border-y border-border-subtle hover:bg-divider-hover active:bg-divider-active relative touch-none flex items-center justify-center transition-colors">
        <GripHorizontal size={14} className="text-grip" />
      </PanelResizeHandle>

      <Panel defaultSize={40} minSize={10}>
        <div className="flex flex-col h-full min-h-0">
          <div className="px-3 py-1.5 bg-bg-elevated text-[11px] font-semibold text-text-secondary uppercase tracking-wider border-b border-border shrink-0">
            Rust Driver
          </div>
          <div className="flex-1 min-h-0">
            <DriverEditor />
          </div>
        </div>
      </Panel>
    </PanelGroup>
  );
}
