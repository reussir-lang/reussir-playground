import { GripHorizontal, GripVertical } from "lucide-react";
import { Group, Panel, Separator } from "react-resizable-panels";

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
    <main className="playground-shell">
      <Toolbar />
      <div className="playground-workspace">
        <Group
          orientation={isMobile ? "vertical" : "horizontal"}
          key={isMobile ? "vertical" : "horizontal"}
        >
          <Panel defaultSize="55%" minSize="15%">
            <EditorPane />
          </Panel>

          <Separator
            className={
              isMobile
                ? "editor-divider h-2.5 border-y border-border-subtle relative touch-none flex items-center justify-center transition-colors"
                : "editor-divider w-2.5 border-x border-border-subtle relative touch-none flex items-center justify-center transition-colors"
            }
          >
            {isMobile ? (
              <GripHorizontal size={14} className="text-grip" />
            ) : (
              <GripVertical size={14} className="text-grip" />
            )}
          </Separator>

          <Panel defaultSize="45%" minSize="15%">
            <OutputPanel />
          </Panel>
        </Group>
      </div>
    </main>
  );
}
