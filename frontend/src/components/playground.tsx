import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { Toolbar } from "@/components/toolbar";
import { EditorPane } from "@/components/editor-pane";
import { OutputPanel } from "@/components/output-panel";
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

          <PanelResizeHandle className="w-1.5 bg-divider hover:bg-divider-hover active:bg-divider-active relative touch-none" />

          <Panel minSize={15}>
            <OutputPanel />
          </Panel>
        </PanelGroup>
      </div>
    </>
  );
}
