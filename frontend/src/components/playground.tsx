import { GripVertical } from "lucide-react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";

import { EditorPane } from "@/components/editor-pane";
import { OutputPanel } from "@/components/output-panel";
import { Toolbar } from "@/components/toolbar";
import { useCompile } from "@/hooks/use-compile";
import { useKeyboardShortcut } from "@/hooks/use-keyboard-shortcut";

export function Playground() {
  const compile = useCompile();
  useKeyboardShortcut("Enter", "ctrlOrMeta", compile);

  return (
    <>
      <Toolbar />
      <div className="flex-1 min-h-0">
        <PanelGroup direction="horizontal">
          <Panel defaultSize={55} minSize={15}>
            <EditorPane />
          </Panel>

          <PanelResizeHandle className="w-2.5 bg-bg-secondary border-x border-border-subtle hover:bg-divider-hover active:bg-divider-active relative touch-none flex items-center justify-center transition-colors">
            <GripVertical size={14} className="text-grip" />
          </PanelResizeHandle>

          <Panel minSize={15}>
            <OutputPanel />
          </Panel>
        </PanelGroup>
      </div>
    </>
  );
}
