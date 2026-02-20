import { GripHorizontal, GripVertical } from "lucide-react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";

import { EditorPane } from "@/components/editor-pane";
import { OutputPanel } from "@/components/output-panel";
import { Toolbar } from "@/components/toolbar";
import { useCompile } from "@/hooks/use-compile";
import { useKeyboardShortcut } from "@/hooks/use-keyboard-shortcut";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSharedState } from "@/hooks/use-shared-state";

export function Playground() {
  const compile = useCompile();
  useKeyboardShortcut("Enter", "ctrlOrMeta", compile);
  useSharedState();
  const isMobile = useIsMobile();

  return (
    <>
      <Toolbar />
      <div className="flex-1 min-h-0">
        <PanelGroup
          direction={isMobile ? "vertical" : "horizontal"}
          key={isMobile ? "vertical" : "horizontal"}
        >
          <Panel defaultSize={isMobile ? 55 : 55} minSize={15}>
            <EditorPane />
          </Panel>

          <PanelResizeHandle
            className={
              isMobile
                ? "h-2.5 bg-bg-secondary border-y border-border-subtle hover:bg-divider-hover active:bg-divider-active relative touch-none flex items-center justify-center transition-colors"
                : "w-2.5 bg-bg-secondary border-x border-border-subtle hover:bg-divider-hover active:bg-divider-active relative touch-none flex items-center justify-center transition-colors"
            }
          >
            {isMobile ? (
              <GripHorizontal size={14} className="text-grip" />
            ) : (
              <GripVertical size={14} className="text-grip" />
            )}
          </PanelResizeHandle>

          <Panel defaultSize={isMobile ? 45 : 45} minSize={15}>
            <OutputPanel />
          </Panel>
        </PanelGroup>
      </div>
    </>
  );
}
